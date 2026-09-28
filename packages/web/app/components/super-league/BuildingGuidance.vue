<script setup vapor lang="ts">
const items = [
	{ label: 'Building for Super League', icon: 'i-tabler-steering-wheel', slot: 'building' as const },
	{ label: 'Community voting', icon: 'i-tabler-notes', slot: 'voting' as const },
]
const buildingTips = [
	{ icon: 'road' as const, title: 'Easy to finish. Fun to improve.', description: 'Build for a wide range of skills. Let the challenge come from better lines, carrying speed and improving times, rather than reaching the finish.' },
	{ icon: 'clock' as const, title: 'Make every run consistent', description: "Avoid unreliable physics, overly precise mandatory tricks or obstacles where timing outside the player's control decides whether a run succeeds." },
	{ icon: 'flag' as const, title: 'Let checkpoints guide the race', description: 'Make the route clear and prevent major shortcuts without getting in the way of racing. Extra checkpoints can give useful split times or stop obvious cuts.' },
]
const votingSteps = [
	{ title: 'Community vote', duration: '1 week', description: 'Once building ends, vote for your favourite eligible submissions.' },
	{ title: 'Official playlist & practice', duration: '1 week', description: 'Up to 14 selected levels become the official playlist. Racers get a week to practise.' },
	{ title: 'Race in Super League', duration: 'Tournament day', description: 'The selected levels are raced in the monthly Zeepkist Super League tournament.' },
]
</script>

<template>
	<UCard>
		<UAccordion :items="items" type="multiple" :ui="{ trigger: 'text-base font-semibold', body: 'flex flex-col gap-5 pb-4 pt-2' }">
			<template #building>
				<p class="mb-3 text-sm leading-relaxed text-muted-foreground">Every submission has a chance of becoming one of up to <strong class="text-highlighted">14 levels raced in the monthly Zeepkist Super League tournament</strong>.</p>
				<ul class="space-y-4">
					<li v-for="tip in buildingTips" :key="tip.title" class="flex gap-3">
						<span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><TablerIcon :name="tip.icon" class="size-5" /></span>
						<div class="space-y-1"><h3 class="text-sm font-semibold text-highlighted">{{ tip.title }}</h3><p class="text-sm leading-relaxed text-muted-foreground">{{ tip.description }}</p></div>
					</li>
				</ul>
				<div class="my-3 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
					<p class="text-sm font-semibold text-highlighted">Accessible to finish, with plenty of room to improve your time.</p>
					<p class="text-sm leading-relaxed text-muted-foreground">These are guidelines, not extra submission rules. Creative, unusual and experimental levels are encouraged!</p>
				</div>
				<UButton to="https://steamcommunity.com/sharedfiles/filedetails/?id=2911644976" target="_blank" rel="noopener noreferrer" color="primary" size="lg" block class="mt-3 whitespace-normal" icon="i-tabler-brand-steam">Browse past contest submissions</UButton>
			</template>
			<template #voting>
				<ol class="space-y-4">
					<li v-for="(step, index) in votingSteps" :key="step.title" class="flex gap-3">
						<span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary" aria-hidden="true">{{ index + 1 }}</span>
						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold text-highlighted">{{ step.title }}</h3><UBadge color="primary" variant="soft" size="lg" class="px-3 py-1 text-sm">{{ step.duration }}</UBadge></div>
							<p class="text-sm leading-relaxed text-muted-foreground">{{ step.description }}</p>
						</div>
					</li>
				</ol>
				<div class="my-3 space-y-2 rounded-xl border border-border bg-elevated/50 p-4">
					<h3 class="text-sm font-semibold text-highlighted">Decoration & layout awards are separate</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">There are no prizes for being selected for Super League. Best Decoration and Best Track Layout use separate votes and do not affect the Super League selection.</p>
				</div>
				<p class="text-sm leading-relaxed text-muted-foreground">Join the Official Zeepkist Discord for voting, playlist and tournament announcements. See the Steam contest announcement for this contest's prizes and other ways to take part.</p>
				<UButton to="https://discord.gg/v554J4paQV" target="_blank" rel="noopener noreferrer" color="primary" size="lg" block class="mt-3 whitespace-normal bg-[#5865f2] text-white hover:bg-[#4752c4] focus-visible:outline-[#5865f2] dark:bg-[#5865f2] dark:text-white dark:hover:bg-[#4752c4]" icon="i-tabler-brand-discord">Join the Zeepkist Discord</UButton>
			</template>
		</UAccordion>
	</UCard>
</template>
