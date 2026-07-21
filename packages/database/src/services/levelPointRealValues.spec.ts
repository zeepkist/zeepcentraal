import { describe, expect, test } from 'bun:test'
import { levelPointRealFields, sanitizeLevelPointRealValues } from './levelPointRealValues'

const payload = {
	idLevel: 46_596,
	points: 1_764,
	rating: 0.5,
}

describe('level point PostgreSQL real values', () => {
	test('discovers real fields from the level points schema', () => {
		expect(levelPointRealFields).toContain('complexityScore')
		expect(levelPointRealFields).toContain('rating')
		expect(levelPointRealFields).not.toContain('points')
	})

	test('flushes positive and negative float32 underflow values to zero', () => {
		expect(
			sanitizeLevelPointRealValues({
				...payload,
				complexityScore: 5.383155362571492e-49,
				skillSeparation: -5.383155362571492e-49,
			}),
		).toMatchObject({
			complexityScore: 0,
			skillSeparation: 0,
		})
	})

	test('preserves null, undefined, zero, and representable values', () => {
		const sanitized = sanitizeLevelPointRealValues({
			...payload,
			competitiveMerit: null,
			complexityConfidence: undefined,
			qualityScore: 0,
			skillAlignment: 1e-20,
		})

		expect(sanitized.competitiveMerit).toBeNull()
		expect(sanitized.complexityConfidence).toBeUndefined()
		expect(sanitized.qualityScore).toBe(0)
		expect(sanitized.skillAlignment).toBe(1e-20)
	})

	test.each([
		['NaN', Number.NaN],
		['Infinity', Number.POSITIVE_INFINITY],
		['-Infinity', Number.NEGATIVE_INFINITY],
		['overflow', 3.5e38],
	] as const)('rejects %s with level and field context', (_label, value) => {
		expect(() => sanitizeLevelPointRealValues({ ...payload, complexityScore: value })).toThrow(
			`level_points.complexityScore for level ${payload.idLevel}`,
		)
	})

	test('does not mutate source payload', () => {
		const source = { ...payload, complexityScore: 5.383155362571492e-49 }
		const sanitized = sanitizeLevelPointRealValues(source)

		expect(source.complexityScore).toBe(5.383155362571492e-49)
		expect(sanitized.complexityScore).toBe(0)
	})
})
