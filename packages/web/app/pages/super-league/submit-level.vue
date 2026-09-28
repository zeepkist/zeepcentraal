<script setup lang="ts">
import LoginPrompt from '~/components/auth/LoginPrompt.vue'
import SubmissionForm from '~/components/super-league/SubmissionForm.vue'
import SubmissionResult from '~/components/super-league/SubmissionResult.vue'

const route = useRoute()
const session = useSessionStore()
const { login } = useAccountActions()
const roundId = computed(() => {
	const id = Number(route.query.roundId)
	return Number.isInteger(id) && id > 0 ? id : undefined
})
const { contest, submission, loading, saving, error, save, withdraw } = useSuperLeagueSubmission(roundId)
const viewer = computed(() => ({ steamId: session.user?.steamId ?? '', steamName: session.user?.steamName ?? session.user?.steamId ?? '' }))
</script>
<template>
	<UContainer class="space-y-6 py-8">
		<PageHeader eyebrow="Zeepkist Super League" :title="contest ? `Submit level — ${contest.name}` : 'Submit level'" />
		<LoginPrompt v-if="!session.user" title="Enter your level" description="Sign in to submit your level or manage a shared submission." @login="login" />
		<p v-else-if="loading">Loading your submission…</p>
		<template v-else-if="contest">
			<p v-if="contest.submissionsOpen && contest.submissionEnd" class="text-sm text-muted">Submissions close <NuxtTime :datetime="contest.submissionEnd" relative />.</p>
			<UCard>
				<h2 class="mb-3 font-semibold">Contest rules</h2>
				<dl class="grid gap-3 text-sm sm:grid-cols-2">
					<div><dt class="text-muted">Blocks</dt><dd>{{ contest.rules.minBlocks }}–{{ contest.rules.maxBlocks }}</dd></div>
					<div><dt class="text-muted">Author time</dt><dd>{{ contest.rules.minTime }}–{{ contest.rules.maxTime }} seconds</dd></div>
					<div><dt class="text-muted">Minimum checkpoints</dt><dd>{{ contest.rules.minCheckpoints }}</dd></div>
					<div><dt class="text-muted">Required modes</dt><dd>{{ Array.isArray(contest.rules.requiredModes) ? contest.rules.requiredModes.join(', ') || 'None' : 'None' }}</dd></div>
					<div v-if="contest.rules.maxCenterSpan"><dt class="text-muted">Maximum center span</dt><dd>{{ contest.rules.maxCenterSpan }}</dd></div>
				</dl>
				<p v-if="Array.isArray(contest.rules.fixedCheckpoints) && contest.rules.fixedCheckpoints.length" class="mt-3 text-sm text-muted">Required checkpoint positions: {{ contest.rules.fixedCheckpoints }}</p>
			</UCard>
			<SubmissionForm v-if="contest.submissionsOpen" :contest="contest" :submission="submission" :viewer="viewer" :saving="saving" @submit="save" @withdraw="withdraw" />
			<p v-else>Submissions are closed for this round.</p>
			<SubmissionResult v-if="submission" :submission="submission" />
		</template>
		<p v-else-if="session.user && !error">No submission contest available.</p>
		<UAlert v-if="error" color="error" :title="error" />
		<NuxtLink to="/super-league">Back to Super League</NuxtLink>
	</UContainer>
</template>
