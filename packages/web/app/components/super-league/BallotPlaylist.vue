<script setup lang="ts">
import type { SubmissionOverview } from '~/utils/superLeagueSubmission'
import { downloadSubmissionPlaylist } from '~/utils/superLeagueSubmission'

const props = defineProps<{ overview: SubmissionOverview | null; roundId?: number; pending: boolean; error: boolean }>()
const { t } = useAppI18n()
const available = computed(() => {
	const overview = props.overview
	return !props.pending && !props.error && overview?.contest && overview.submissions.length
		&& (props.roundId === undefined || overview.contest.roundId === props.roundId) ? overview : null
})
function download() {
	if (available.value?.contest) downloadSubmissionPlaylist(available.value.contest, available.value.submissions)
}
</script>

<template>
	<div v-if="available" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-4">
		<p class="font-medium text-highlighted">{{ t('zsl.voting.tryMaps') }}</p>
		<UButton icon="i-tabler-download" variant="outline" @click="download">{{ t('zsl.voting.downloadPlaylist') }}</UButton>
	</div>
</template>
