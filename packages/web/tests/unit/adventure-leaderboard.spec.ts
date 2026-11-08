import { describe, expect, it } from 'vitest'
import { formatAdventureTime } from '../../app/utils/adventureLeaderboard'

describe('Adventure cumulative time', () => {
	it('formats integer milliseconds without second or hour rollover errors', () => {
		expect(formatAdventureTime(0)).toBe('00:00.000')
		expect(formatAdventureTime('59999')).toBe('00:59.999')
		expect(formatAdventureTime(60000)).toBe('01:00.000')
		expect(formatAdventureTime(3599999)).toBe('59:59.999')
		expect(formatAdventureTime(3600000)).toBe('1:00:00.000')
		expect(formatAdventureTime(36000001)).toBe('10:00:00.001')
	})
})
