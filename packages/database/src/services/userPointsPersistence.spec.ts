import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('./userPoints.ts', import.meta.url), 'utf8')
const contributionService = readFileSync(
	new URL('./userPointContribution.ts', import.meta.url),
	'utf8',
)

test('skips unchanged player points and rank writes', () => {
	expect(contributionService).toContain(
		`WHERE ROW(\${userPoints.points}, \${userPoints.totalPoints}, \${userPoints.worldRecords})\n\t\t\t\tIS DISTINCT FROM ROW(EXCLUDED.points, EXCLUDED.total_points, EXCLUDED.world_records)`,
	)
	expect(service).toContain('target.rank IS DISTINCT FROM source.rank')
	expect(service).toContain('AND ROW(points, rank) IS DISTINCT FROM ROW(0, -1)')
	expect(service).toContain('AND player_decayed_points IS DISTINCT FROM 0::real')
})
