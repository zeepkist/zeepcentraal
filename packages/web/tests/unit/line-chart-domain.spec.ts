import { describe, expect, it } from 'vitest'
import { getEvenlySpacedYAxis, getLineChartYDomain } from '../../app/utils/lineChartDomain'
import { getUserCareerPointsAxis, getUserCareerRankAxis } from '../../app/utils/userCareerHistory'

describe('line chart y-axis bounds', () => {
	it.each([
		{ values: [3, 7.5], domain: [2, 8] },
		{ values: [-7.5, -3], domain: [-8, -2] },
		{ values: [-1.5, 0.5], domain: [-2, 2] },
		{ values: [2, 8], domain: [2, 10] },
		{ values: [-4, -2], domain: [-4, 0] },
		{ values: [6], domain: [6, 8] },
		{ values: [0, 0], domain: [0, 2] },
	])('scales $values to $domain', ({ values, domain }) => {
		expect(
			getLineChartYDomain(
				values.map((value) => ({ value })),
				['value'],
			),
		).toEqual(domain)
	})

	it('uses finite values from visible series only', () => {
		const data = [
			{ time: 100, first: 5, second: null, hidden: 200 },
			{ time: 101, first: Infinity, second: 9, hidden: -200 },
			{ time: 102, first: NaN, second: -Infinity },
			{ time: 103, second: -3 },
		]
		expect(getLineChartYDomain(data, ['first', 'second'])).toEqual([-4, 10])
		expect(getLineChartYDomain(data, ['first'])).toEqual([4, 6])
	})

	it('defers to the chart when no finite values are visible', () => {
		expect(getLineChartYDomain([], ['value'])).toBeUndefined()
		expect(getLineChartYDomain([{ value: 4 }], [])).toBeUndefined()
		expect(
			getLineChartYDomain([{ value: null }, { value: NaN }, {}], ['value']),
		).toBeUndefined()
	})

	it('uses multiples of ten for world records and inverted ranks', () => {
		expect(getLineChartYDomain([{ value: 12 }, { value: 20 }], ['value'], 10)).toEqual([10, 30])
		expect(getLineChartYDomain([{ value: -17 }, { value: -1 }], ['value'], 10)).toEqual([
			-20, 0,
		])
	})

	it('rounds career points bounds outward to whole compact units', () => {
		const domain = (min: number, max: number) =>
			getUserCareerPointsAxis([{ value: min }, { value: max }])?.domain

		expect(domain(61_450, 67_410)).toEqual([61_000, 69_000])
		expect(domain(2_250, 3_000)).toEqual([2_000, 4_000])
		expect(domain(985_000, 1_450_000)).toEqual([0, 2_000_000])
	})
})

describe('evenly spaced y-axis ticks', () => {
	it.each([
		{ domain: [-20, 0], ticks: [-20, -10, 0] },
		{ domain: [10, 30], ticks: [10, 20, 30] },
		{ domain: [-210, 210], ticks: [-210, -70, 70, 210] },
		{ domain: [-210, 310], ticks: [-210, -80, 50, 180, 310] },
		{ domain: [30, 100], ticks: [30, 50, 70, 90, 110] },
	] as const)('uses a uniform 10-unit grid across $domain', ({ domain, ticks }) => {
		expect(getEvenlySpacedYAxis(domain, 10)).toEqual({
			domain: [ticks.at(0), ticks.at(-1)],
			ticks,
		})
	})

	it('keeps the upper bound close when points span thousands and millions', () => {
		expect(getUserCareerPointsAxis([{ value: 620_000 }, { value: 10_850_000 }])).toEqual({
			domain: [0, 12_000_000],
			ticks: [0, 3_000_000, 6_000_000, 9_000_000, 12_000_000],
		})
	})

	it('anchors the rank grid at #1 when the normal scale reaches zero', () => {
		expect(getUserCareerRankAxis([-20, 0])).toEqual({
			domain: [-21, -1],
			ticks: [-21, -11, -1],
		})
		expect(getUserCareerRankAxis([-30, -10])).toEqual({
			domain: [-30, -10],
			ticks: [-30, -20, -10],
		})
	})
})
