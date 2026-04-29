<script lang="ts">
	import { user, userData, db } from '$lib/firebase';
	import {
		type Program,
		getProgramSchedule,
		getProgramDays,
		getRoutineExercises
	} from '$lib/state.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
	import NewProgramSheet from '$lib/components/NewProgramSheet.svelte';
	import EditProgramSheet from '$lib/components/EditProgramSheet.svelte';
	import FAB from '$lib/components/Buttons/FAB.svelte';
	import EditIcon from '$lib/icons/edit.svg?raw';
	import { goto } from '$app/navigation';

	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	let showNewProgramSheet = $state(false);
	let showEditProgramSheet = $state(false);

	let newProgramName = $state('');
	let editedProgramName = $state('');
	let editingProgram: Program | undefined = $state(undefined);
	let isEditingPrograms = $state(false);

	let todayDow = $derived(new Date().getDay());

	let activeProgramId = $derived($userData?.activeProgramId ?? null);
	let activeProgram = $derived(
		($userData?.programs ?? []).find((s) => s.id === activeProgramId) ?? null
	);
	let otherPrograms = $derived(($userData?.programs ?? []).filter((s) => s.id !== activeProgramId));

	function getTodayEntry(program: Program) {
		return getProgramSchedule(program).find((sd) => sd.day === todayDow) ?? null;
	}

	function getDayCount(program: Program): number {
		return getProgramDays(program).length;
	}


	function getDayExerciseCount(program: Program, day: number): number {
		const sd = getProgramSchedule(program).find((s) => s.day === day);
		if (!sd) return 0;
		return sd.items.reduce((sum, item) => {
			if (item.type === 'exercise') return sum + 1;
			const routine = $userData?.routines?.find((r) => r.id === item.routineId);
			return sum + (routine ? getRoutineExercises(routine).length : 0);
		}, 0);
	}

	async function handleNewProgramSave(name: string) {
		if (!$userData) return;
		const userRef = doc(db, 'users', $user!.uid);
		const newProgram: Program = {
			id: uuidv4(),
			name,
			schedule: []
		};
		try {
			await updateDoc(userRef, { programs: arrayUnion(newProgram) });
			goto(`/programs/${newProgram.id}`);
			newProgramName = '';
		} catch (error) {}
	}

	function handleProgramEditClick(program: Program) {
		editingProgram = program;
		showEditProgramSheet = true;
	}

	async function handleEditProgramSave(name: string, notes: string) {
		if (!$userData) return;
		const programs = $userData.programs ?? [];
		const idx = programs.findIndex((s) => s.id === editingProgram?.id);
		const userRef = doc(db, 'users', $user!.uid);
		const original = { ...programs[idx] };
		programs[idx] = { ...programs[idx], name, ...(notes ? { notes } : { notes: undefined }) };
		try {
			await updateDoc(userRef, { programs });
		} catch {
			programs[idx] = original;
		}
		isEditingPrograms = false;
	}

	async function handleEditProgramDelete() {
		if (!$userData) return;
		const programs = $userData.programs ?? [];
		const idx = programs.findIndex((s) => s.id === editingProgram?.id);
		const userRef = doc(db, 'users', $user!.uid);
		const deleted = programs.splice(idx, 1)[0];
		const extra: Record<string, unknown> = { programs };
		if (deleted.id === activeProgramId) extra.activeProgramId = null;
		try {
			await updateDoc(userRef, extra);
		} catch {
			programs.splice(idx, 0, deleted);
		}
		isEditingPrograms = false;
	}

	async function handleSetActive(session: Program) {
		if (!$userData) return;
		const userRef = doc(db, 'users', $user!.uid);
		await updateDoc(userRef, { activeProgramId: session.id });
	}
</script>

<div class="mx-auto flex w-full max-w-lg flex-col gap-4">
	<!-- Header -->
	<div class="flex justify-end">
		{#if ($userData?.programs?.length ?? 0) > 0}
			<button
				class="btn btn-ghost btn-sm w-14 font-semibold"
				class:text-primary={isEditingPrograms}
				onclick={() => (isEditingPrograms = !isEditingPrograms)}
			>
				{isEditingPrograms ? 'Done' : 'Edit'}
			</button>
		{/if}
	</div>

	{#if $userData === undefined}
		<div class="flex flex-col gap-3">
			{#each { length: 3 } as _}
				<div class="skeleton h-24 w-full rounded-2xl"></div>
			{/each}
		</div>
	{:else if ($userData?.programs?.length ?? 0) > 0}
		<!-- ── Active Program ──────────────────────────────────────── -->
		{#if activeProgram}
			{@const todayEntry = getTodayEntry(activeProgram)}
			{@const dayCount = getDayCount(activeProgram)}
			{@const todayExCount = todayEntry ? getDayExerciseCount(activeProgram, todayEntry.day) : 0}
			<div class="flex flex-col gap-1.5">
				<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
					Active Program
				</p>
				<div
					class="border-primary/30 bg-primary/8 rounded-box relative flex flex-col gap-3 overflow-hidden border px-4 py-4"
				>
					<div class="bg-primary rounded-l-box absolute top-0 left-0 h-full w-1"></div>
					<div class="ml-2 flex items-start justify-between gap-2">
						<div class="flex flex-1 flex-col gap-0.5 overflow-hidden">
							<span class="truncate text-base font-bold">{activeProgram.name}</span>
						{#if activeProgram.notes}
							<p class="text-base-content/50 mt-0.5 line-clamp-2 text-xs">{activeProgram.notes}</p>
						{/if}
						{#if dayCount > 0}
							<div class="mt-1.5 flex items-end gap-2">
								{#each DAY_SHORT as label, i}
									{@const scheduled = getProgramDays(activeProgram).includes(i)}
									{@const isToday = i === todayDow}
									<div class="flex flex-col items-center gap-0.5">
										<span
											class={[
												'text-[10px] font-bold leading-none transition-colors',
												isToday
													? 'text-primary'
													: scheduled
														? 'text-base-content/50'
														: 'text-base-content/20'
											].join(' ')}
										>{label}</span
										>
										<div
											class={[
												'rounded-full transition-all',
												scheduled && isToday
													? 'bg-primary h-1.5 w-1.5'
													: scheduled
														? 'bg-primary/40 h-1 w-1'
														: 'bg-transparent h-1 w-1'
											].join(' ')}
										></div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-base-content/40 text-xs">No days scheduled yet</p>
						{/if}

						<!-- Start / Edit overlay -->
						<div class="relative shrink-0">
							<!-- Start button: fades out when editing, no today entry, or no exercises -->
							<button
								type="button"
								class="btn btn-primary btn-sm transition-opacity duration-200"
								style:opacity={!isEditingPrograms && todayEntry && todayExCount > 0 ? '1' : '0'}
								style:pointer-events={!isEditingPrograms && todayEntry && todayExCount > 0 ? 'auto' : 'none'}
								onclick={() => goto(`/programs/${activeProgram!.id}/run?day=${todayDow}`)}
								>Start</button
							>
							<!-- Edit pencil: fades in when editing -->
							<button
								class="btn btn-ghost btn-sm absolute inset-0 flex items-center justify-center transition-opacity duration-200 [&>svg]:h-4 [&>svg]:w-4"
								style:opacity={isEditingPrograms ? '1' : '0'}
								style:pointer-events={isEditingPrograms ? 'auto' : 'none'}
								onclick={() => handleProgramEditClick(activeProgram!)}
								aria-label="Edit program">{@html EditIcon}</button
							>
						</div>
					</div>

					<!-- Today entry — collapses when editing -->
					<div
						class="grid transition-all duration-200 ease-out"
						style:grid-template-rows={isEditingPrograms ? '0fr' : '1fr'}
						style:opacity={isEditingPrograms ? '0' : '1'}
					>
						<div class="overflow-hidden">
							{#if todayEntry && todayExCount > 0}
								<!-- Scheduled day with exercises -->
								<a
									href={`/programs/${activeProgram.id}`}
									class="border-primary/20 bg-primary/10 hover:bg-primary/15 mt-1 ml-2 flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors"
								>
									<div>
										<p class="text-primary text-xs font-semibold tracking-wide uppercase">
											Today · {DAY_NAMES[todayDow]}
										</p>
										{#if todayEntry.label}
											<p class="mt-0.5 text-sm font-semibold">{todayEntry.label}</p>
										{/if}
										<p class="text-base-content/50 text-xs">
											{todayExCount} exercise{todayExCount !== 1 ? 's' : ''}
										</p>
									</div>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="text-primary/50 h-4 w-4 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</a>
							{:else if todayEntry && todayExCount === 0}
								<!-- Scheduled day but no exercises added yet -->
								<a
									href={`/programs/${activeProgram.id}`}
									class="border-base-content/10 mt-1 ml-2 flex items-center justify-between rounded-xl border border-dashed px-3 py-2.5 transition-colors"
								>
									<div>
										<p class="text-base-content/40 text-xs font-semibold tracking-wide uppercase">
											Today · {DAY_NAMES[todayDow]}
										</p>
										<p class="text-base-content/35 text-xs">No exercises added yet · Tap to set up</p>
									</div>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="text-base-content/20 h-4 w-4 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</a>
							{:else}
								<!-- Rest day -->
								<a
									href={`/programs/${activeProgram.id}`}
									class="mt-1 ml-2 flex items-center justify-between"
								>
									<p class="text-base-content/35 text-xs">Rest day · Tap to view schedule</p>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="text-base-content/20 h-4 w-4 shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</a>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
		{/if}

		<!-- ── Other Programs ─────────────────────────────────────── -->
		{#if otherPrograms.length > 0}
			<div class="flex flex-col gap-2">
				{#if activeProgram}
					<p class="text-base-content/50 text-xs font-semibold tracking-widest uppercase">
						Other Programs
					</p>
				{/if}
				{#each otherPrograms as session}
					{@const dayCount = getDayCount(session)}
					<a
						href={isEditingPrograms ? undefined : `/programs/${session.id}`}
						onclick={isEditingPrograms
							? (e) => {
									e.preventDefault();
									handleProgramEditClick(session);
								}
							: undefined}
						class="bg-base-200 hover:bg-base-300 rounded-box relative flex items-center gap-3 overflow-hidden px-4 py-3.5 transition-colors active:scale-[0.98]"
					>
						<div class="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
							<span class="truncate font-semibold">{session.name}</span>
							{#if session.notes && !isEditingPrograms}
								<p class="text-base-content/45 line-clamp-1 text-xs">{session.notes}</p>
							{/if}
							<div
								class="grid transition-all duration-200 ease-out"
								style:grid-template-rows={isEditingPrograms ? '0fr' : '1fr'}
								style:opacity={isEditingPrograms ? '0' : '1'}
							>
								<div class="overflow-hidden">
								{#if dayCount > 0}
									<div class="mt-1 flex items-end gap-1.5">
										{#each DAY_SHORT as label, i}
											{@const scheduled = getProgramDays(session).includes(i)}
											{@const isToday = i === todayDow}
											<div class="flex flex-col items-center gap-0.5">
												<span
													class={[
														'text-[9px] font-bold leading-none',
														scheduled
															? isToday
																? 'text-primary'
																: 'text-base-content/40'
															: 'text-base-content/15'
													].join(' ')}
												>{label}</span
												>
												<div
													class={[
														'h-1 w-1 rounded-full',
														scheduled && isToday
															? 'bg-primary'
															: scheduled
																? 'bg-base-content/30'
																: 'bg-transparent'
													].join(' ')}
												></div>
											</div>
										{/each}
									</div>
								{:else}
									<p class="text-base-content/30 text-xs">No days scheduled</p>
								{/if}
								</div>
							</div>
						</div>
						{#if isEditingPrograms}
							<button
								type="button"
								class="btn btn-outline btn-primary btn-xs shrink-0"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									handleSetActive(session);
								}}>Set Active</button
							>
							<button
								type="button"
								class="btn btn-ghost btn-sm shrink-0"
								onclick={(e) => {
									e.preventDefault();
									handleProgramEditClick(session);
								}}
								aria-label="Edit program"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z"
									/>
								</svg>
							</button>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/30 h-4 w-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	{:else if $user}
		<div class="flex flex-col items-center gap-4 py-20 text-center">
			<div class="bg-base-200 rounded-full p-6">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-base-content/40 h-10 w-10"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
			<div>
				<p class="font-semibold">No programs yet</p>
				<p class="text-base-content/50 mt-1 max-w-xs text-sm">
					Create a training program, schedule it across the week, and the app will guide you through
					each day.
				</p>
			</div>
			<button class="btn btn-primary" onclick={() => (showNewProgramSheet = true)}>
				Create your first program
			</button>
		</div>
	{/if}
</div>

<FAB onclick={() => (showNewProgramSheet = true)} hidden={isEditingPrograms} />

<NewProgramSheet
	bind:open={showNewProgramSheet}
	bind:newProgramName
	onSave={handleNewProgramSave}
/>

<EditProgramSheet
	bind:open={showEditProgramSheet}
	bind:name={editedProgramName}
	{editingProgram}
	onSave={handleEditProgramSave}
	onDelete={handleEditProgramDelete}
/>
