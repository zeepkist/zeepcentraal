import type { SubmissionContest } from './superLeagueSubmission'

export function superLeagueActiveRound(
	contests: SubmissionContest[],
	activity: 'vote' | 'submit-level',
): number | undefined {
	return contests
		.filter((contest) =>
			activity === 'submit-level' ? contest.submissionsOpen : contest.openTypes.length > 0,
		)
		.map((contest) => {
			const deadlines =
				activity === 'submit-level'
					? [contest.submissionEnd]
					: contest.openTypes.map((type) =>
							type === 1 ? contest.zslVoteEnd : contest.cosmeticVoteEnd,
						)
			const deadline = Math.min(
				...deadlines.flatMap((value) => {
					const timestamp = value === null ? Number.NaN : Date.parse(value)
					return Number.isFinite(timestamp) ? [timestamp] : []
				}),
			)
			return { contest, deadline }
		})
		.filter(({ deadline }) => Number.isFinite(deadline))
		.sort(
			(a, b) =>
				a.deadline - b.deadline ||
				b.contest.seasonId - a.contest.seasonId ||
				b.contest.round - a.contest.round ||
				b.contest.roundId - a.contest.roundId,
		)[0]?.contest.roundId
}

export function parseSuperLeagueSlug(value: unknown, prefix: string): number | null {
	if (typeof value !== 'string') return null
	const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value)
	if (!match?.[1]) return null
	const id = Number(match[1])
	return Number.isSafeInteger(id) && id > 0 ? id : null
}

export const superLeagueSeasonPath = (seasonId: number) => `/super-league/season-${seasonId}`

export const superLeagueRoundPath = (seasonId: number, roundNumber: number) =>
	`${superLeagueSeasonPath(seasonId)}/round-${roundNumber}`

export const superLeagueVotesPath = (seasonId: number, roundNumber: number) =>
	`${superLeagueRoundPath(seasonId, roundNumber)}/votes`

export const superLeagueLevelPath = (seasonId: number, roundNumber: number, levelId: number) =>
	`${superLeagueRoundPath(seasonId, roundNumber)}/level-${levelId}`
