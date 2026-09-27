<script setup vapor lang="ts">
defineProps<{ voteType: number }>()

const zslCriteria = [
	{ title: 'Gameplay', text: 'Look for smooth flow and room to set competitive times.' },
	{ title: 'Learning curve', text: 'An average player should be able to learn the track and set a time within 7 minutes. Avoid tracks that are too difficult.' },
	{ title: 'Judge the track', text: 'Focus on the level, not its author or decoration. Pick tracks that work for competitive racing, not troll or challenge levels.' },
	{ title: 'Cuts', text: 'A cut does not rule a level out. If it is selected, we will add a checkpoint to fix the cut.' },
	{ title: 'Your own levels', text: 'Do not vote for a level you built or helped build.' },
	{ title: 'Theme', text: 'Check that the level meets the round’s theme requirements.' },
]
</script>

<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<template v-if="voteType === 1">
			<h2 class="text-lg font-semibold text-highlighted">Choosing Zeepkist Super League levels</h2>
			<p class="mt-1 text-sm text-muted-foreground">Pick up to 14 levels you would want to race in the tournament.</p>
			<ul class="mt-5 grid gap-3 sm:grid-cols-2">
				<li v-for="criterion in zslCriteria" :key="criterion.title" class="rounded-lg border border-border bg-background/60 p-4">
					<h3 class="font-semibold text-highlighted">{{ criterion.title }}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ criterion.text }}</p>
				</li>
			</ul>
		</template>
		<template v-else-if="voteType === 2">
			<h2 class="text-lg font-semibold text-highlighted">Best decoration</h2>
			<p class="mt-1 text-sm text-muted-foreground">Pick up to 3 levels you thought had the best decoration. Builders of the top 4 levels earn in-game cosmetics.</p>
		</template>
		<template v-else>
			<h2 class="text-lg font-semibold text-highlighted">Best track layout</h2>
			<p class="mt-1 text-sm text-muted-foreground">Pick up to 3 levels you thought had the best track layout to drive. Builders of the top 4 levels earn in-game cosmetics.</p>
		</template>
	</UCard>
</template>
