<script lang="ts" module>
	import type { Workout } from '$lib/types';

	/** An exercise already in the routine or on the day. */
	export type PresentExercise = {
		workoutId: string;
		/** False when it's only there as part of a scheduled routine. */
		removable: boolean;
		/** Replaces the section label under the name, e.g. "In Push Day". */
		note?: string;
		/** Removing it also drops its set and rep targets, so the row says so. */
		hasTargets?: boolean;
	};

	export type AddedItem =
		{ type: 'exercise'; workoutId: string } | { type: 'routine'; routineId: string };

	/** Everything the user confirmed, ready to write in one batch. */
	export type PlanChange = {
		/** In the order picked. */
		add: AddedItem[];
		/** Exercises to create first — picked from Discover or typed in. */
		create: Workout[];
		remove: { exercises: string[]; routines: string[] };
	};
</script>

<script lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import CheckIcon from '$lib/components/CheckIcon.svelte';
	import { session } from '$lib/session.svelte';
	import { loadCatalog, type Catalog } from '$lib/catalog';
	import { matchExercise, normalizeName } from '$lib/catalog/match';
	import { resolvePicks, type ExercisePick } from '$lib/catalog/picks';
	import { EQUIPMENT_LABELS, MUSCLE_LABELS, exerciseMatches } from '$lib/catalog/labels';
	import type { Routine } from '$lib/types';

	/**
	 * Adds exercises (and, on a program day, routines) by ticking rows and
	 * confirming once. What's already there stays in view — the sheet's backdrop
	 * hides the page — and can be marked for removal in the same pass. Search
	 * covers the library and Discover, and a name with no match can be created
	 * on the spot, so a brand-new user always has something to pick.
	 */

	interface Props {
		open?: boolean;
		title?: string;
		/** Names what the present items belong to: "In this routine", "On Monday". */
		presentLabel: string;
		presentExercises: PresentExercise[];
		/** Program days only; omit to hide the routines segment. */
		routines?: { all: Routine[]; present: string[] };
		onSave: (change: PlanChange) => void;
	}

	let {
		open = $bindable(false),
		title = 'Add exercises',
		presentLabel,
		presentExercises,
		routines,
		onSave
	}: Props = $props();

	type Pick = { key: string; name: string } & (
		{ kind: 'exercise'; pick: ExercisePick } | { kind: 'routine'; routineId: string }
	);

	let segment = $state<'exercises' | 'routines'>('exercises');
	let search = $state('');
	let picks = $state<Pick[]>([]);
	let removals = $state<string[]>([]);
	let catalog = $state<Catalog | null>(null);

	$effect(() => {
		if (open) {
			if (!catalog) {
				loadCatalog()
					.then((c) => (catalog = c))
					.catch(() => {}); // Discover suggestions are a bonus; the library still works.
			}
			return;
		}
		segment = 'exercises';
		search = '';
		picks = [];
		removals = [];
	});

	// ── Rows ────────────────────────────────────────────────────────────────────
	type RowState = 'add' | 'picked' | 'present' | 'removing' | 'locked';
	type Row = { key: string; name: string; sub: string; state: RowState; order?: number };

	let query = $derived(normalizeName(search));
	const hit = (name: string) => !query || normalizeName(name).includes(query);

	const pickIndex = (key: string) => picks.findIndex((p) => p.key === key);

	function addRow(key: string, name: string, sub: string): Row {
		const i = pickIndex(key);
		return i === -1
			? { key, name, sub, state: 'add' }
			: { key, name, sub, state: 'picked', order: i + 1 };
	}

	function presentRow(
		key: string,
		name: string,
		removable: boolean,
		note: string,
		hasTargets = false
	): Row {
		if (!removable) return { key, name, sub: note, state: 'locked' };
		return removals.includes(key)
			? {
					key,
					name,
					sub: hasTargets ? 'Will be removed, with its targets' : 'Will be removed',
					state: 'removing'
				}
			: { key, name, sub: note, state: 'present' };
	}

	function lastDone(w: Workout): number {
		return w.sets.reduce((latest, s) => Math.max(latest, new Date(s.date).getTime()), 0);
	}

	let presentIds = $derived(new Set(presentExercises.map((p) => p.workoutId)));

	let presentRows = $derived(
		presentExercises.flatMap((p) => {
			const w = session.workout(p.workoutId);
			if (!w || !hit(w.name)) return [];
			return [presentRow(`w:${w.id}`, w.name, p.removable, p.note ?? presentLabel, p.hasTargets)];
		})
	);

	let typedRows = $derived(
		picks.flatMap((p) =>
			p.kind === 'exercise' && p.pick.kind === 'new' ? [addRow(p.key, p.name, 'New exercise')] : []
		)
	);

	let libraryRows = $derived(
		(session.workouts ?? [])
			.filter((w) => !presentIds.has(w.id) && hit(w.name))
			.map((w) => ({ w, at: lastDone(w) }))
			.sort((a, b) => b.at - a.at || a.w.name.localeCompare(b.w.name))
			.map(({ w, at }) =>
				addRow(
					`w:${w.id}`,
					w.name,
					at ? `Last done ${formatDistanceToNow(at, { addSuffix: true })}` : 'Never done'
				)
			)
	);

	/** Discover exercises the library doesn't already have for certain. */
	let catalogRows = $derived.by(() => {
		if (!catalog) return [];
		const workouts = session.workouts ?? [];
		return catalog.exercises
			.filter(
				(e) => matchExercise(e, workouts)?.confidence !== 'certain' && exerciseMatches(e, search)
			)
			.map((e) =>
				addRow(
					`c:${e.id}`,
					e.name,
					`${MUSCLE_LABELS[e.muscles[0]]} · ${EQUIPMENT_LABELS[e.equipment]}`
				)
			);
	});

	/** Offered when the typed name matches nothing in the library or Discover. */
	let createName = $derived.by(() => {
		const name = search.trim();
		if (!query) return null;
		const taken =
			(session.workouts ?? []).some((w) => normalizeName(w.name) === query) ||
			(catalog?.exercises ?? []).some((e) =>
				[e.name, ...(e.aliases ?? [])].some((n) => normalizeName(n) === query)
			) ||
			picks.some((p) => normalizeName(p.name) === query);
		return taken ? null : name;
	});

	let presentRoutineRows = $derived(
		(routines?.present ?? []).flatMap((id) => {
			const r = session.routine(id);
			return r && hit(r.name) ? [presentRow(`r:${r.id}`, r.name, true, presentLabel)] : [];
		})
	);

	let routineRows = $derived(
		(routines?.all ?? [])
			.filter((r) => !routines?.present.includes(r.id) && hit(r.name))
			.map((r) =>
				addRow(
					`r:${r.id}`,
					r.name,
					`${r.exercises.length} exercise${r.exercises.length === 1 ? '' : 's'}`
				)
			)
	);

	// ── Toggling ────────────────────────────────────────────────────────────────
	function toggle(row: Row) {
		if (row.state === 'locked') return;
		if (row.state === 'present' || row.state === 'removing') {
			removals = removals.includes(row.key)
				? removals.filter((k) => k !== row.key)
				: [...removals, row.key];
			return;
		}
		const i = pickIndex(row.key);
		if (i !== -1) {
			picks = picks.filter((p) => p.key !== row.key);
			return;
		}
		const [prefix, id] = [row.key.slice(0, 1), row.key.slice(2)];
		const next: Pick =
			prefix === 'r'
				? { key: row.key, name: row.name, kind: 'routine', routineId: id }
				: {
						key: row.key,
						name: row.name,
						kind: 'exercise',
						pick:
							prefix === 'c'
								? { kind: 'catalog', catalogId: id }
								: { kind: 'library', workoutId: id }
					};
		picks = [...picks, next];
	}

	function pickTyped(name: string) {
		picks = [
			...picks,
			{ key: `n:${normalizeName(name)}`, name, kind: 'exercise', pick: { kind: 'new', name } }
		];
		search = '';
	}

	// ── Footer ──────────────────────────────────────────────────────────────────
	let noun = $derived(
		picks.some((p) => p.kind === 'routine') || removals.some((k) => k.startsWith('r:'))
			? 'item'
			: 'exercise'
	);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	let confirmLabel = $derived(
		picks.length && removals.length
			? `Add ${picks.length} · Remove ${removals.length}`
			: picks.length
				? `Add ${plural(picks.length, noun)}`
				: `Remove ${plural(removals.length, noun)}`
	);

	function confirm() {
		const library = session.library;
		if (!library) return;
		const exercisePicks = picks.filter((p) => p.kind === 'exercise');
		const resolved = resolvePicks(
			exercisePicks.map((p) => p.pick),
			library,
			catalog
		);
		let e = 0;
		const add = picks.flatMap((p): AddedItem[] => {
			if (p.kind === 'routine') return [{ type: 'routine', routineId: p.routineId }];
			const id = resolved.byPick[e++];
			return id ? [{ type: 'exercise', workoutId: id }] : [];
		});
		onSave({
			add,
			create: resolved.create,
			remove: {
				exercises: removals.filter((k) => k.startsWith('w:')).map((k) => k.slice(2)),
				routines: removals.filter((k) => k.startsWith('r:')).map((k) => k.slice(2))
			}
		});
		open = false;
	}

	let changed = $derived(picks.length + removals.length > 0);
</script>

{#snippet sectionLabel(text: string)}
	<p class="text-base-content/40 mt-2 text-xs font-semibold tracking-widest uppercase">{text}</p>
{/snippet}

{#snippet row(r: Row)}
	{@const circle = {
		add: 'border-base-content/25 border-2',
		picked: 'bg-primary text-primary-content',
		present: 'bg-base-content/15 text-base-content/60',
		removing: 'bg-error text-error-content',
		locked: 'bg-base-content/10 text-base-content/40'
	}[r.state]}
	<button
		type="button"
		class={[
			'rounded-box flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
			r.state === 'picked'
				? 'bg-primary/10'
				: r.state === 'removing'
					? 'bg-error/10'
					: r.state === 'locked'
						? 'bg-base-200 opacity-50'
						: 'bg-base-200 hover:bg-base-300'
		].join(' ')}
		disabled={r.state === 'locked'}
		aria-pressed={r.state === 'picked' || r.state === 'removing'}
		aria-label={r.state === 'present'
			? `${r.name}, ${r.sub}. Tap to remove`
			: r.state === 'removing'
				? `${r.name}, will be removed. Tap to keep`
				: `${r.name}, ${r.sub}`}
		onclick={() => toggle(r)}
	>
		<span
			class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold {circle}"
			aria-hidden="true"
		>
			{#if r.state === 'picked'}
				{r.order}
			{:else if r.state === 'present' || r.state === 'locked'}
				<CheckIcon class="h-3.5 w-3.5" />
			{:else if r.state === 'removing'}
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="3"><path stroke-linecap="round" d="M5 12h14" /></svg
				>
			{/if}
		</span>
		<span class="min-w-0 flex-1">
			<span
				class="block truncate text-sm font-semibold {r.state === 'removing' ? 'line-through' : ''}"
				>{r.name}</span
			>
			<span
				class="block truncate text-xs {r.state === 'removing'
					? 'text-error font-medium'
					: 'text-base-content/50'}">{r.sub}</span
			>
		</span>
	</button>
{/snippet}

{#snippet toolbar()}
	<div class="flex flex-col gap-3">
		{#if routines}
			<div role="tablist" class="tabs tabs-box grid grid-cols-2">
				{#each [['exercises', 'Exercises'], ['routines', 'Routines']] as const as [id, label]}
					<button
						role="tab"
						class="tab"
						class:tab-active={segment === id}
						aria-selected={segment === id}
						onclick={() => (segment = id)}>{label}</button
					>
				{/each}
			</div>
		{/if}
		<input
			type="search"
			autocomplete="off"
			enterkeyhint={createName && segment === 'exercises' ? 'done' : 'search'}
			placeholder={segment === 'exercises' ? 'Search or create an exercise' : 'Search routines'}
			aria-label={segment === 'exercises' ? 'Search or create an exercise' : 'Search routines'}
			class="input input-bordered w-full"
			bind:value={search}
			onkeydown={(e) => {
				if (e.key !== 'Enter') return;
				if (createName && segment === 'exercises') pickTyped(createName);
				else (e.currentTarget as HTMLInputElement).blur();
			}}
		/>
	</div>
{/snippet}

{#snippet footer()}
	<button class="btn w-full {picks.length ? 'btn-primary' : 'btn-error'}" onclick={confirm}
		>{confirmLabel}</button
	>
{/snippet}

<BottomSheet
	bind:open
	size="large"
	fill
	autofocus={false}
	{title}
	{toolbar}
	footer={changed ? footer : undefined}
>
	<div class="flex flex-col gap-2">
		{#if segment === 'exercises'}
			{#if createName}
				<button
					type="button"
					class="border-primary/40 text-primary rounded-box flex items-center gap-3 border border-dashed px-4 py-3 text-left"
					onclick={() => pickTyped(createName!)}
				>
					<span class="flex h-6 w-6 shrink-0 items-center justify-center text-lg leading-none"
						>+</span
					>
					<span class="min-w-0 flex-1 truncate text-sm font-semibold">Create “{createName}”</span>
				</button>
			{/if}

			{#if presentRows.length}
				{@render sectionLabel(presentLabel)}
				{#each presentRows as r (r.key)}{@render row(r)}{/each}
			{/if}

			{#if typedRows.length || libraryRows.length}
				{@render sectionLabel('Your exercises')}
				{#each typedRows as r (r.key)}{@render row(r)}{/each}
				{#each libraryRows as r (r.key)}{@render row(r)}{/each}
			{/if}

			{#if catalogRows.length}
				{@render sectionLabel('From Discover')}
				{#each catalogRows as r (r.key)}{@render row(r)}{/each}
			{:else if !catalog}
				{@render sectionLabel('From Discover')}
				{#each { length: 3 } as _}<div class="skeleton h-14 w-full rounded-xl"></div>{/each}
			{/if}

			{#if query && !createName && !presentRows.length && !typedRows.length && !libraryRows.length && !catalogRows.length}
				<p class="text-base-content/50 py-6 text-center text-sm">No match for “{search.trim()}”.</p>
			{/if}
		{:else}
			{#if presentRoutineRows.length}
				{@render sectionLabel(presentLabel)}
				{#each presentRoutineRows as r (r.key)}{@render row(r)}{/each}
			{/if}
			{#if routineRows.length}
				{@render sectionLabel('Your routines')}
				{#each routineRows as r (r.key)}{@render row(r)}{/each}
			{/if}
			{#if !presentRoutineRows.length && !routineRows.length}
				<p class="text-base-content/50 py-6 text-center text-sm">
					{query ? `No routine matches “${search.trim()}”.` : 'You have no routines yet.'}
				</p>
			{/if}
		{/if}
	</div>
</BottomSheet>
