import { readFileSync } from 'node:fs'
import { parse, print, visit } from 'graphql'
import { describe, expect, it } from 'vitest'
import {
	buildVoteDistributionCounts,
	voteDistributionTotal,
} from '../../app/utils/voteDistribution'

const queryFiles = ['levelDetail.graphql', 'userProfile.graphql'].map((name) =>
	readFileSync(
		new URL(`../../../graphql/documents/web/queries/${name}`, import.meta.url),
		'utf8',
	),
)
const chart = readFileSync(
	new URL('../../app/components/common/VoteDistributionChart.vue', import.meta.url),
	'utf8',
)

describe('vote distribution aggregates', () => {
	it('derives exact counts from grouped sums and total count', () => {
		const counts = buildVoteDistributionCounts(
			[
				{ keys: ['2'], sum: { value: '12618' } },
				{ keys: ['0'], sum: { value: '0' } },
				{ keys: ['-2'], sum: { value: '-7780' } },
				{ keys: ['1'], sum: { value: '3965' } },
				{ keys: ['-1'], sum: { value: '-2153' } },
			],
			17_108,
		)

		expect(counts).toEqual({ 2: 6309, 1: 3965, 0: 791, [-1]: 2153, [-2]: 3890 })
		expect(voteDistributionTotal(counts)).toBe(17_108)
	})

	it('uses the residual count for zero votes and keeps missing groups at zero', () => {
		expect(buildVoteDistributionCounts([{ keys: [2], sum: { value: 6n } }], 5)).toEqual({
			2: 3,
			1: 0,
			0: 2,
			[-1]: 0,
			[-2]: 0,
		})
		expect(buildVoteDistributionCounts([], 0)).toEqual({
			2: 0,
			1: 0,
			0: 0,
			[-1]: 0,
			[-2]: 0,
		})
	})

	it('ignores malformed, unsupported, fractional, and impossible groups', () => {
		const counts = buildVoteDistributionCounts(
			[
				{ keys: ['3'], sum: { value: '9' } },
				{ keys: ['2'], sum: { value: '3' } },
				{ keys: ['1'], sum: { value: 'not-a-count' } },
				{ keys: ['-1'], sum: { value: '-20' } },
				{ keys: null, sum: { value: '1' } },
			],
			10,
		)

		expect(counts).toEqual({ 2: 0, 1: 0, 0: 10, [-1]: 0, [-2]: 0 })
	})
})

describe('vote distribution GraphQL and chart', () => {
	it('requests grouped sums and totals without vote nodes or identities', () => {
		for (const query of queryFiles) {
			let votesSelection = ''
			visit(parse(query), {
				Field(node) {
					if (node.name.value === 'votes') votesSelection = print(node)
				},
			})

			expect(votesSelection).toContain('votes(first: 0)')
			expect(votesSelection).toContain('groupedAggregates(groupBy: VALUE)')
			expect(votesSelection).toContain('keys')
			expect(votesSelection).toContain('sum')
			expect(votesSelection).toContain('value')
			expect(votesSelection).toContain('totalCount')
			expect(votesSelection).not.toMatch(
				/\bnodes\b|\bedges\b|\buser\b|\buserId\b|\blevel\b|\blevelId\b/,
			)
		}
	})

	it('uses the shared compact donut with fixed labels and strength colours', () => {
		expect(chart).toContain('<DashboardDonutChart')
		expect(chart).toContain('compact')
		for (const key of [
			'strong-positive',
			'positive',
			'neutral',
			'negative',
			'strong-negative',
		]) {
			expect(chart).toContain(`key: '${key}'`)
		}
		expect(chart).not.toContain('key: String(value)')
		for (const label of ["'++'", "'+'", "'+-/-+'", "'-'", "'--'"]) {
			expect(chart).toContain(`label: ${label}`)
		}
		for (const color of ['#16a34a', '#86efac', '#facc15', '#fca5a5', '#dc2626']) {
			expect(chart).toContain(color)
		}
		expect(chart).toContain('v-if="total > 0"')
		expect(chart).toContain('labels.empty')
	})
})
