import { describe, expect, it } from 'vitest'
import {
	submissionAuthorChoices,
	submissionProcessing,
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
