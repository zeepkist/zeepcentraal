<script setup lang="ts">
import type { SubmissionContest } from '~/utils/superLeagueSubmission'

const props = defineProps<{ roundIds?: number[] }>()
const config = useRuntimeConfig()
const { data, refresh } = useFetch<SubmissionContest[]>(new URL('/super-league/contests', String(config.public.backendUrl)).toString())
const contests = computed(() => (data.value ?? []).filter(c => !props.roundIds || props.roundIds.includes(c.roundId)))
const submissions = computed(() => contests.value.filter(c => c.submissionsOpen))
const votes = computed(() => contests.value.filter(c => c.openTypes.length))
const results = computed(() => contests.value.filter(c => c.resultTypes?.length))
const deadlines = computed(() => contests.value.flatMap(c => [c.submissionStart, c.submissionEnd, c.zslVoteEnd, c.cosmeticVoteEnd]))
useContestDeadlineRefresh(deadlines, refresh)
</script>
<template>
	<div v-if="submissions.length || votes.length || results.length" class="flex flex-wrap gap-3">
		<UButton v-for="contest in submissions" :key="`submit-${contest.roundId}`" :to="`/super-league/submit-level?roundId=${contest.roundId}`" icon="i-tabler-upload" size="lg">Submit level<span v-if="submissions.length > 1"> — {{ contest.name }}</span></UButton>
		<UButton v-for="contest in votes" :key="`vote-${contest.roundId}`" :to="`/super-league/vote?roundId=${contest.roundId}`" icon="i-tabler-notes" size="lg">Vote for levels<span v-if="votes.length > 1"> — {{ contest.name }}</span></UButton>
		<UButton v-for="contest in results" :key="`results-${contest.roundId}`" :to="superLeagueVotesPath(contest.seasonId, contest.round)" icon="i-tabler-chart-bar" variant="outline" size="lg">{{ $t('zsl.voting.resultsTitle') }}<span v-if="results.length > 1"> · {{ contest.name }}</span></UButton>
	</div>
</template>
