import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { SubmissionContest } from '../../app/utils/superLeagueSubmission'
import { publishedVoteContests } from '../../app/utils/superLeagueVoteResults'
import en from '../../i18n/locales/en.json'

const contest = (seasonId: number, round: number, resultTypes = [1]): SubmissionContest => ({
	roundId: seasonId * 100 + round,
	contestId: 1,
	seasonId,
	round,
	name: `Round ${round}`,
	rules: {},
	steamAnnouncementId: null,
	submissionStart: null,
	submissionEnd: null,
	zslVoteEnd: null,
	cosmeticVoteEnd: null,
	submissionsOpen: false,
	openTypes: [],
	resultTypes,
})

describe('published tournament navigation', () => {
	it('sorts published tournaments by season then round without changing input', () => {
		const input = [contest(7, 9), contest(8, 1), contest(9, 1, []), contest(8, 2, [2])]
		expect(publishedVoteContests(input).map((value) => value.roundId)).toEqual([802, 801, 709])
		expect(input.map((value) => value.roundId)).toEqual([709, 801, 901, 802])
	})
	it('preserves season scope and handles empty or single results', () => {
		const input = [contest(7, 9), contest(8, 1), contest(8, 2, [])]
		expect(
			publishedVoteContests(input.filter((value) => value.seasonId === 8)).map(
				(value) => value.roundId,
			),
		).toEqual([801])
		expect(publishedVoteContests([])).toEqual([])
		expect(publishedVoteContests([contest(9, 1, [])])).toEqual([])
	})
})

describe('category vote summary', () => {
	const { t } = createI18n({ legacy: false, locale: 'en', messages: { en } }).global
	it.each([
		[333, 29, '333 votes by 29 players'],
		[1, 1, '1 vote by 1 player'],
		[0, 0, '0 votes by 0 players'],
		[10, 1, '10 votes by 1 player'],
	])('formats %i votes by %i players', (votes, players, expected) => {
		expect(
			`${t('zsl.voting.voteCount', { count: String(votes) }, votes)} ${t('zsl.voting.playerCount', { count: String(players) }, players)}`,
		).toBe(expected)
	})
})
