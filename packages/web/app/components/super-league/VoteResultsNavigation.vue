<script setup lang="ts">
import type { SubmissionContest } from '~/utils/superLeagueSubmission'
import { publishedVoteContests } from '~/utils/superLeagueVoteResults'

const props = defineProps<{ contests: SubmissionContest[]; currentRoundId?: number; seasonId?: number }>()
const { t } = useAppI18n()
const results = computed(() => publishedVoteContests(props.contests))
const current = computed(() => props.contests.find(contest => contest.roundId === props.currentRoundId) ?? results.value[0])
const label = (contest: SubmissionContest) => t(contest.seasonId === props.seasonId ? 'zsl.voting.seasonTournament' : 'zsl.voting.tournament', { season: contest.seasonId, round: contest.round, name: contest.name })
const primaryLabel = computed(() => {
	if (!current.value || current.value.roundId === props.currentRoundId) return t('zsl.voting.resultsTitle')
	return `${t('zsl.voting.resultsTitle')} · ${label(current.value)}`
})
const items = computed(() => results.value.map(contest => ({
	label: label(contest),
	to: superLeagueVotesPath(contest.seasonId, contest.round),
	icon: contest.roundId === current.value?.roundId ? 'i-tabler-check' : undefined,
	'aria-current': contest.roundId === props.currentRoundId ? 'page' as const : undefined,
})))
</script>

<template>
	<UFieldGroup v-if="results.length && current" size="lg" class="max-w-full">
		<UButton :to="superLeagueVotesPath(current.seasonId, current.round)" icon="i-tabler-chart-bar" variant="outline" class="min-w-0">
			<span class="whitespace-normal text-left">{{ primaryLabel }}</span>
		</UButton>
		<UDropdownMenu v-if="results.length > 1" :items="items" :content="{ align: 'end' }" :ui="{ content: 'max-w-[calc(100vw-2rem)]', itemLabel: 'whitespace-normal' }">
			<UButton icon="i-tabler-chevron-down" variant="outline" square :aria-label="t('zsl.voting.otherTournaments')" />
		</UDropdownMenu>
	</UFieldGroup>
</template>
