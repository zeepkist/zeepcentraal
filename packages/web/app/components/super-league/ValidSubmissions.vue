<script setup lang="ts">
import LevelCard from '~/components/level/LevelCard.vue'
import type { SubmissionContest, SubmissionOverview } from '~/utils/superLeagueSubmission'
import { downloadSubmissionPlaylist } from '~/utils/superLeagueSubmission'

const props = defineProps<{ contest: SubmissionContest; overview: SubmissionOverview | null; error: string | null }>()
const emit = defineEmits<{ refresh: [] }>()
const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
function download() {
	if (props.overview?.submissions.length) downloadSubmissionPlaylist(props.contest, props.overview.submissions)
}
</script>

<template>
	<section class="space-y-4" aria-labelledby="valid-submissions-title">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 id="valid-submissions-title" class="text-xl font-semibold text-highlighted">Valid submissions<span v-if="overview"> ({{ numberFormat.format(overview.validCount) }})</span></h2>
			<UButton icon="i-tabler-download" :disabled="!overview?.submissions.length" @click="download">Download .zeeplist</UButton>
		</div>
		<UAlert v-if="error" color="error" :title="error" :actions="[{ label: 'Try again', onClick: () => emit('refresh') }]" />
		<p v-if="overview && !overview.submissions.length" class="text-muted-foreground">No valid submissions yet.</p>
		<div v-else-if="overview" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<div v-for="submission in overview.submissions" :key="submission.id" class="flex flex-col gap-2">
				<LevelCard :level="submission.level" transition-scope="zsl-submissions" adventure-label="Adventure" points-label="Points" records-label="Records" personal-bests-label="Personal bests" rating-label="Rating" unavailable-label="—" />
				<p class="text-sm text-muted-foreground">{{ submission.authorNames.join(', ') }}</p>
				<UButton :to="`https://steamcommunity.com/sharedfiles/filedetails/?id=${submission.workshopId}`" target="_blank" rel="noopener noreferrer" variant="outline" color="neutral" icon="i-tabler-brand-steam">Steam Workshop</UButton>
			</div>
		</div>
	</section>
</template>
