import { describe, expect, it } from 'vitest'
import { formatMedalSettlementDuration } from '../../app/utils/medals'

describe('medal settlement duration', () => {
	it.each([
		[4648 * 60_000, '3d 5h 28m'],
		[328 * 60_000, '5h 28m'],
		[28 * 60_000, '28m'],
		[60_001, '2m'],
		[60_000, '1m'],
		[1, '1m'],
		[0, '0m'],
		[-1, '0m'],
		[1440 * 60_000, '1d 0h 0m'],
	])('formats %i milliseconds as %s', (milliseconds, expected) => {
		expect(formatMedalSettlementDuration(milliseconds)).toBe(expected)
	})
})
