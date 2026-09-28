import { describe, expect, it } from 'vitest'
import {
	steamContestAnnouncementUrl,
	submissionAuthorChoices,
	submissionProcessing,
	submissionRuleLimits,
	submissionWorkshopId,
} from '../../app/utils/superLeagueSubmission'

describe('first-party submission contract', () => {
	it('allows missing Steam accounts by ID while keeping name searches and exclusions intact', () => {
		const id = '76561198000000999'
		expect(submissionAuthorChoices(id, [], [])).toEqual([
			{ steamId: id, steamName: 'Steam account' },
		])
		expect(submissionAuthorChoices(id, [], [id])).toEqual([])
		for (const term of ['Builder', '123', '76561198000000999x', '00000000000000000'])
			expect(submissionAuthorChoices(term, [], [])).toEqual([])
		const known = [{ steamId: id, steamName: 'Builder' }]
		expect(submissionAuthorChoices('Bui', known, [])).toEqual(known)
		expect(submissionAuthorChoices(id, known, [id])).toEqual([])
	})
	it('extracts decimal workshop IDs only from exact workshop URLs', () => {
		expect(
			submissionWorkshopId(
				'https://steamcommunity.com/sharedfiles/filedetails/?id=3801858959',
			),
		).toBe('3801858959')
		for (const url of [
			'3801858959',
			'http://steamcommunity.com/sharedfiles/filedetails/?id=1',
			'https://steamcommunity.com/sharedfiles/filedetails/?id=0',
			'https://steamcommunity.com/sharedfiles/filedetails/?id=01',
			'https://steamcommunity.com/sharedfiles/filedetails/?id=abc',
			'https://steamcommunity.com/sharedfiles/filedetails/?id=1&foo=bar',
			'https://steamcommunity.com.evil/sharedfiles/filedetails/?id=1',
		])
			expect(submissionWorkshopId(url)).toBeNull()
	})
	it('keeps retries processing without treating them as invalid', () => {
		for (const status of ['queued', 'validating', 'retrying'] as const)
			expect(submissionProcessing(status)).toBe(true)
		for (const status of ['complete', 'withdrawn', undefined] as const)
			expect(submissionProcessing(status)).toBe(false)
	})
})

describe('contest announcement and rule limits', () => {
	it('constructs the Steam article URL without rounding its bigint ID', () => {
		expect(steamContestAnnouncementUrl('705530288588981646')).toBe(
			'https://steamcommunity.com/games/1440670/announcements/detail/705530288588981646',
		)
		for (const id of [null, undefined, '', '0', '-1', 'https://example.com'])
			expect(steamContestAnnouncementUrl(id)).toBeNull()
	})
	it('uses configured limits and supplies generic defaults only when absent', () => {
		expect(
			submissionRuleLimits({ minTime: 30, maxTime: 50, maxBlocks: 2000, minCheckpoints: 5 }),
		).toEqual({ minTime: 30, maxTime: 50, maxBlocks: 2000, minCheckpoints: 5 })
		expect(submissionRuleLimits({})).toEqual({
			minTime: 25,
			maxTime: 60,
			maxBlocks: 3000,
			minCheckpoints: 3,
		})
	})
})
