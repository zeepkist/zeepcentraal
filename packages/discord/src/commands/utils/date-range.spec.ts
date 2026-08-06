import { expect, test } from 'bun:test'
import { dateRange } from './date-range'

const now = new Date('2026-08-06T12:00:00Z')

test.each([
	['today', '2026-08-06T00:00:00.000Z'],
	['yesterday', '2026-08-05T00:00:00.000Z'],
	['this-week', '2026-08-03T00:00:00.000Z'],
	['last-week', '2026-07-27T00:00:00.000Z'],
	['this-month', '2026-08-01T00:00:00.000Z'],
	['last-month', '2026-07-01T00:00:00.000Z'],
	['this-year', '2026-01-01T00:00:00.000Z'],
	['last-year', '2025-01-01T00:00:00.000Z'],
	['all-time', '2000-01-01T00:00:00.000Z'],
] as const)('date range %s starts at expected boundary', (range, from) => {
	const result = dateRange(range, null, null, now)
	expect(result.from).toBe(from)
	expect(result.label).toBe(range.replaceAll('-', ' '))
	expect(new Date(result.to).getTime()).toBeGreaterThan(new Date(result.from).getTime())
})

test('date range accepts inclusive custom end date', () => {
	expect(dateRange('custom', '2026-08-01', '2026-08-02', now)).toEqual({
		from: '2026-08-01T00:00:00.000Z',
		to: '2026-08-03T00:00:00.000Z',
		label: 'custom',
	})
})

test('date range rejects missing, invalid, reversed, and unknown ranges', () => {
	expect(() => dateRange('custom', null, null, now)).toThrow('Custom range needs')
	expect(() => dateRange('custom', 'bad', '2026-08-02', now)).toThrow(
		'Custom date range is invalid.',
	)
	expect(() => dateRange('custom', '2026-08-03', '2026-08-01', now)).toThrow(
		'Custom date range is invalid.',
	)
	expect(() => dateRange('never', null, null, now)).toThrow('Unknown date range.')
})
