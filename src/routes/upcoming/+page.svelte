<script lang="ts">
	const upcomingFeatures = [
		{
			title: 'Weight Tracking',
			description: 'Add weight information for each exercise set to better track your progress.',
			estimatedRelease: 'Coming Soon'
		},
		{
			title: 'Workout Folders',
			description:
				'Create workout routines to help you stay on track and reach your fitness goals.',
			estimatedRelease: 'Coming Soon'
		}
	];
</script>

<section class="prose px-16">
	<h1>Upcoming Features</h1>

	{#each upcomingFeatures as feature}
		<div class="feature-card">
			<h2>{feature.title}</h2>
			<p>{feature.description}</p>
			<span class="release-date">{feature.estimatedRelease}</span>
		</div>
	{/each}
</section>
