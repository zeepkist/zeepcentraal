import type { SubmissionContest } from '~/utils/superLeagueSubmission'

export function useSuperLeagueContests() {
	const read = useFetch<SubmissionContest[]>('/api/super-league/contests')
	const deadlines = computed(() =>
		(read.data.value ?? []).flatMap((contest) => [
			contest.submissionStart,
			contest.submissionEnd,
			contest.zslVoteEnd,
			contest.cosmeticVoteEnd,
		]),
	)
	useContestDeadlineRefresh(deadlines, read.refresh)
	return read
}
