import { expect, test } from 'bun:test'
import { parseContestTitle } from './matching'

test('anchored season and round title parsing', () => {
	expect(parseContestTitle('S8R1 Mixed Surfaces')).toEqual({
		season: 8,
		round: 1,
		theme: 'Mixed Surfaces',
	})
	for (const title of [
		'Mixed Surfaces',
		'prefix S8R1 Theme',
		'S0R1 Theme',
		'S8R1',
		'S999999999999999999R1 Theme',
	])
		expect(parseContestTitle(title)).toBeUndefined()
})
