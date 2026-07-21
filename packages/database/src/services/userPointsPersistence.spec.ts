import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('./userPoints.ts', import.meta.url), 'utf8')

test('skips unchanged player points and rank writes', () => {
	expect(service).toContain(
		`ROW(\${userPoints.points}, \${userPoints.totalPoints}) IS DISTINCT FROM ROW(EXCLUDED.points, EXCLUDED.total_points)`,
	)
	expect(service).toContain('target.rank IS DISTINCT FROM source.rank')
	expect(service).toContain(
		`ROW(\${userPoints.points}, \${userPoints.rank}) IS DISTINCT FROM ROW(\${points}, \${rank})`,
	)
})
