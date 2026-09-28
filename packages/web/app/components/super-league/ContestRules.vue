<script setup vapor lang="ts">
import type { SubmissionContest } from '~/utils/superLeagueSubmission'
import { submissionRuleLimits } from '~/utils/superLeagueSubmission'

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const props = defineProps<{ contest: SubmissionContest }>()
const limits = computed(() => submissionRuleLimits(props.contest.rules))
const modes = computed(() => Array.isArray(props.contest.rules.requiredModes) ? props.contest.rules.requiredModes.join(', ') : '')
const checkpoints = computed(() => Array.isArray(props.contest.rules.fixedCheckpoints) ? props.contest.rules.fixedCheckpoints : [])
</script>

<template>
	<UCard :ui="{ root: 'border-primary/15', body: 'space-y-5' }">
		<template #header>
			<div class="flex items-center gap-3">
				<TablerIcon name="notes" class="size-5 text-primary" />
				<h2 class="text-lg font-semibold text-highlighted">Contest rules</h2>
			</div>
		</template>
		<p class="text-sm text-muted-foreground">Follow the theme requirements for {{ contest.name }}, along with these rules. The Steam announcement has the full theme details.</p>
		<ul class="space-y-4 text-sm leading-relaxed">
			<li><strong>One submission per player.</strong> You may replace or update your Workshop level or submission until the deadline.</li>
			<li><strong>Up to 3 builders.</strong> A collaboration counts as the submission for every listed builder.</li>
			<li><strong>Build during this contest.</strong> Existing levels or levels published before the contest period cannot be submitted.</li>
			<li><strong>{{ limits.minTime }}–{{ limits.maxTime }} seconds to finish.</strong> Drive at a reasonable pace along the intended route. Levels outside this range will be disqualified. Automatic validation measures the saved author time.</li>
			<li><strong>At least {{ limits.minCheckpoints }} checkpoints.</strong> Add more where needed to prevent shortcuts or make the intended route clear.</li>
			<li><strong>Make the route clear, consistent and raceable.</strong> No hidden routes, hidden linked checkpoints, misleading or risky finishes, or other elements that make progression unnecessarily difficult to understand. ZSL is not the tournament for challenge or troll levels.</li>
			<li><strong>Maximum {{ numberFormat.format(limits.maxBlocks) }} blocks.</strong></li>
			<li><NuxtLink to="https://steamcommunity.com/ogg/1440670/announcements/detail/705528385946782729?snr=2___" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary underline underline-offset-4">Logic 2.0 is allowed and encouraged!</NuxtLink> Use logic blocks, moving blocks, gates, triggers, timers and other Logic 2.0 mechanics.</li>
			<li class="rounded-lg border border-error/20 bg-error/5 p-3"><strong>Random/RNG blocks are not allowed.</strong> These Logic 2.0 blocks have a cheese or dice icon in-game. Levels must behave consistently between attempts; cheese/random blocks mean disqualification.</li>
		</ul>
		<dl v-if="modes || contest.rules.maxCenterSpan || checkpoints.length" class="space-y-3 rounded-lg bg-elevated p-4 text-sm">
			<div v-if="modes"><dt class="font-medium">Required modes</dt><dd class="mt-1 text-muted-foreground">{{ modes }}</dd></div>
			<div v-if="contest.rules.maxCenterSpan"><dt class="font-medium">Maximum center span</dt><dd class="mt-1 text-muted-foreground">{{ contest.rules.maxCenterSpan }}</dd></div>
			<div v-if="checkpoints.length"><dt class="font-medium">Required checkpoint positions</dt><dd class="mt-1 break-words text-muted-foreground">{{ checkpoints }}</dd></div>
		</dl>
	</UCard>
</template>
