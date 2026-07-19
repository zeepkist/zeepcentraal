import { describe, expect, test } from 'bun:test'
import { levelPointRealFields, sanitizeLevelPointRealValues } from './levelPointRealValues'

const payload = {
	idLevel: 46_596,
	points: 1_764,
	rating: 0.5,
}

describe('level point PostgreSQL real values', () => {
	test('discovers real fields from the level points schema', () => {
		expect(levelPointRealFields).toContain('passivePlaySeverity')
		expect(levelPointRealFields).toContain('rating')
		expect(levelPointRealFields).not.toContain('points')
	})

	test('flushes positive and negative float32 underflow values to zero', () => {
		expect(
			sanitizeLevelPointRealValues({
				...payload,
				passivePlaySeverity: 5.383155362571492e-49,
				leaderboardAnomalyScore: -5.383155362571492e-49,
			}),
		).toMatchObject({
			passivePlaySeverity: 0,
			leaderboardAnomalyScore: 0,
		})
	})

	test('preserves null, undefined, zero, and representable values', () => {
		const sanitized = sanitizeLevelPointRealValues({
			...payload,
			passivePlaySeverity: null,
			leaderboardAnomalyScore: undefined,
			telemetryAnomalyScore: 0,
			worldRecordMargin: 1e-20,
		})

		expect(sanitized.passivePlaySeverity).toBeNull()
		expect(sanitized.leaderboardAnomalyScore).toBeUndefined()
		expect(sanitized.telemetryAnomalyScore).toBe(0)
		expect(sanitized.worldRecordMargin).toBe(1e-20)
	})

	test.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY],
		['overflow', 3.5e38],
	] as const)('rejects %s with level and field context', (_label, value) => {
		expect(() =>
			sanitizeLevelPointRealValues({ ...payload, passivePlaySeverity: value }),
		).toThrow(`level_points.passivePlaySeverity for level ${payload.idLevel}`)
	})

	test('does not mutate source payload', () => {
		const source = { ...payload, passivePlaySeverity: 5.383155362571492e-49 }
		const sanitized = sanitizeLevelPointRealValues(source)

		expect(source.passivePlaySeverity).toBe(5.383155362571492e-49)
		expect(sanitized.passivePlaySeverity).toBe(0)
	})
})
