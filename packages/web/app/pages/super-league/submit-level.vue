<script setup lang="ts">
import LoginPrompt from '~/components/auth/LoginPrompt.vue'
import BuildingGuidance from '~/components/super-league/BuildingGuidance.vue'
import ContestLoading from '~/components/super-league/ContestLoading.vue'
import ContestRules from '~/components/super-league/ContestRules.vue'
import SubmissionForm from '~/components/super-league/SubmissionForm.vue'
import SubmissionResult from '~/components/super-league/SubmissionResult.vue'
import { steamContestAnnouncementUrl, submissionRuleLimits } from '~/utils/superLeagueSubmission'

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const route = useRoute()
const session = useSessionStore()
const { login } = useAccountActions()
const roundId = computed(() => {
	const id = Number(route.query.roundId)
	return Number.isInteger(id) && id > 0 ? id : undefined
})
const { contest, submission, loading, resolved, initial, saving, error, refresh, save, withdraw } = useSuperLeagueSubmission(roundId)
const viewer = computed(() => ({ steamId: session.user?.steamId ?? '', steamName: session.user?.steamName ?? session.user?.steamId ?? '' }))
const announcement = computed(() => steamContestAnnouncementUrl(contest.value?.steamAnnouncementId))
const limits = computed(() => submissionRuleLimits(contest.value?.rules ?? {}))
await initial
</script>

<template>
	<UContainer class="space-y-6 py-8">
		<PageHeader eyebrow="Zeepkist Super League" title="Submit your level" :description="contest?.name" />
		<LoginPrompt v-if="session.resolved && !session.pending && !session.user" title="Enter your level" description="Sign in to submit your level or manage a shared submission." @login="login" />
		<ContestLoading v-else-if="loading" label="Loading level contest" />
		<template v-else-if="contest">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<p v-if="contest.submissionsOpen && contest.submissionEnd" class="flex items-center gap-2 text-sm text-muted-foreground"><TablerIcon name="clock" class="size-4 text-primary" />Submissions close <NuxtTime :datetime="contest.submissionEnd" relative />.</p>
				<UButton v-if="announcement" :to="announcement" target="_blank" rel="noopener noreferrer" icon="i-tabler-brand-steam" class="whitespace-normal" variant="outline" color="neutral">View the full level submission rules on Steam</UButton>
			</div>
			<dl class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<div class="rounded-xl border border-border bg-card p-4"><dt class="text-sm text-muted-foreground">Completion time</dt><dd class="mt-1 text-lg font-semibold text-highlighted">{{ limits.minTime }}–{{ limits.maxTime }} seconds</dd></div>
				<div class="rounded-xl border border-border bg-card p-4"><dt class="text-sm text-muted-foreground">Block limit</dt><dd class="mt-1 text-lg font-semibold text-highlighted">{{ numberFormat.format(limits.maxBlocks) }}</dd></div>
				<div class="rounded-xl border border-border bg-card p-4"><dt class="text-sm text-muted-foreground">Checkpoints</dt><dd class="mt-1 text-lg font-semibold text-highlighted">At least {{ limits.minCheckpoints }}</dd></div>
				<div class="rounded-xl border border-border bg-card p-4"><dt class="text-sm text-muted-foreground">Builders</dt><dd class="mt-1 text-lg font-semibold text-highlighted">Up to 3</dd></div>
			</dl>
			<div class="grid items-start gap-6 xl:grid-cols-2">
				<div class="space-y-6">
					<SubmissionForm v-if="contest.submissionsOpen" :contest="contest" :submission="submission" :viewer="viewer" :saving="saving" @submit="save" @withdraw="withdraw" />
					<UAlert v-else color="neutral" title="Submissions are closed for this round." />
					<SubmissionResult v-if="submission" :submission="submission" />
					<BuildingGuidance />
				</div>
				<ContestRules :contest="contest" />
			</div>
		</template>
		<p v-else-if="resolved && !error">No submission contest available.</p>
		<UAlert v-if="error" color="error" :title="error" :actions="[{ label: 'Try again', onClick: () => refresh() }]" />
		<UButton to="/super-league" variant="link" color="primary">Back to Super League</UButton>
	</UContainer>
</template>
