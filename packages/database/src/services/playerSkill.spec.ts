import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('./playerSkill.ts', import.meta.url), 'utf8')

test('builds player skill only from raw PB placements', () => {
	expect(service).toContain('FROM personal_best_global')
	expect(service).toContain('INNER JOIN record')
	expect(service).not.toContain('FROM level_points')
	expect(service).not.toContain('JOIN level_points')
	expect(service).not.toContain('FROM user_points')
	expect(service).not.toContain('JOIN user_points')
	expect(service).not.toContain('user_point_contribution')
})

test('uses tie-aware placement and excludes target contribution', () => {
	expect(service).toContain('RANK() OVER')
	expect(service).toContain('aggregate.placement_sum -')
	expect(service).toContain('target.placement * target.target_contributed')
	expect(service).toContain('aggregate.eligible_level_count - target.target_contributed >=')
})

test('derives map selectivity from skill alignment and time separation', () => {
	expect(service).toContain('CORR(skill_percentile, placement)')
	expect(service).toContain('skill_percentile BETWEEN 0.4 AND 0.6')
	expect(service).toContain('skill_percentile >= 0.8')
	expect(service).toContain('placement_rank <= 10')
})
