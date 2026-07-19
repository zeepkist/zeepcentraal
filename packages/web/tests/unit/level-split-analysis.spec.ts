import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	buildLevelSplitAnalysis,
	resolveGhostFinishSpeed,
} from '../../app/utils/levelSplitAnalysis'

const query = readFileSync(
	new URL('../../app/graphql/queries/levelSplitAnalysis.graphql', import.meta.url),
	'utf8',
)
const component = readFileSync(
	new URL('../../app/components/level/LevelSplitAnalysis.vue', import.meta.url),
	'utf8',
)
const toggle = readFileSync(
	new URL('../../app/components/level/LevelSplitComparisonToggle.vue', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/level/[xxh128].vue', import.meta.url), 'utf8')

function splitRecord(id: number, time: number) {
	return {
		id,
		time,
		splits: [time * 0.4, time * 0.75],
		speeds: [100 - id, 110 - id],
		user: { steamId: String(id), steamName: `Player ${id}` },
	}
}

describe('level checkpoint analysis', () => {
	it('requests exactly five current PBs and conditionally fetches the viewer PB', () => {
		expect(query).toContain('first: 5')
		expect(query).toContain('personalBestGlobalsExist: true')
		expect(query).toContain('splits: { isNull: false }')
		expect(query).toContain('speeds: { isNull: false }')
		expect(query).toContain('orderBy: [TIME_ASC, ID_ASC]')
		expect(query).toContain('viewerPersonalBest: personalBestGlobalByUserIdAndLevelId')
		expect(query).toContain('@include(if: $includeViewer)')
	})

	it('calculates checkpoint deltas against fastest compatible player', () => {
		const result = buildLevelSplitAnalysis([
			{
				id: 1,
				time: 10,
				splits: [4, 8],
				speeds: [80, 90],
				user: { steamId: '1', steamName: 'Fast' },
			},
			{
				id: 2,
				time: 11,
				splits: [4.5, 8.5],
				speeds: [75, 85],
				user: { steamId: '2', steamName: 'Close' },
			},
		])
		expect(result.checkpointCount).toBe(2)
		expect(result.series[0]?.deltas).toEqual([0, 0, 0])
		expect(result.series[1]?.deltas).toEqual([0.5, 0.5, 1])
		expect(result.deltaData).toEqual([
			{ checkpoint: 1, record_1: 0, record_2: 0.5 },
			{ checkpoint: 2, record_1: 0, record_2: 0.5 },
			{ checkpoint: 3, record_1: 0, record_2: 1 },
		])
		expect(result.speedData[1]).toEqual({ checkpoint: 2, record_1: 90, record_2: 85 })
		expect(result.speedData).toHaveLength(2)
	})

	it('preserves supplied ghost colours for record analysis charts', () => {
		const result = buildLevelSplitAnalysis([
			{
				id: 1,
				time: 10,
				color: '#12ab34',
				splits: [4, 8],
				speeds: [80, 90],
			},
		])

		expect(result.series[0]?.color).toBe('#12ab34')
	})

	it('adds finish speed only when supplied and never fabricates missing values', () => {
		const result = buildLevelSplitAnalysis([
			{ id: 1, time: 10, splits: [4, 8], speeds: [80, 90], finishSpeed: 95 },
			{ id: 2, time: 11, splits: [4.5, 9], speeds: null },
		])

		expect(result.speedData).toHaveLength(3)
		expect(result.speedData[0]).toEqual({ checkpoint: 1, record_1: 80 })
		expect(result.speedData[1]).toEqual({ checkpoint: 2, record_1: 90 })
		expect(result.speedData[2]).toEqual({ checkpoint: 3, record_1: 95 })
		expect(result.speedData.some((point) => point.record_2 === 0)).toBe(false)
	})

	it('reads exact finish speed from the final parsed ghost frame', () => {
		expect(resolveGhostFinishSpeed([{ speed: 80 }, { speed: 95.5 }])).toBe(95.5)
		expect(resolveGhostFinishSpeed([{ speed: 80 }, {}])).toBeNull()
		expect(resolveGhostFinishSpeed([])).toBeNull()
	})

	it('renders finish analysis for levels without intermediate checkpoints', () => {
		const result = buildLevelSplitAnalysis([
			{ id: 1, time: 10, splits: [], speeds: [], finishSpeed: 95 },
			{ id: 2, time: 11, splits: [], speeds: [], finishSpeed: null },
		])

		expect(result.checkpointCount).toBe(0)
		expect(result.deltaData).toEqual([{ checkpoint: 1, record_1: 0, record_2: 1 }])
		expect(result.speedData).toEqual([{ checkpoint: 1, record_1: 95 }])
	})

	it('appends a compatible viewer PB after the top five and marks it for dotted rendering', () => {
		const topFive = Array.from({ length: 5 }, (_, index) => splitRecord(index + 1, 10 + index))
		const viewer = splitRecord(6, 16)
		const result = buildLevelSplitAnalysis(topFive, viewer)

		expect(result.series.map((series) => series.recordId)).toEqual([1, 2, 3, 4, 5, 6])
		expect(result.series.slice(0, 5).every((series) => !series.viewer)).toBe(true)
		expect(result.series[5]?.viewer).toBe(true)
		expect(result.series[5]?.viewerComparison).toBe(true)
	})

	it('marks but does not duplicate a viewer already in the top five', () => {
		const topFive = Array.from({ length: 5 }, (_, index) => splitRecord(index + 1, 10 + index))
		const result = buildLevelSplitAnalysis(topFive, topFive[2])

		expect(result.series).toHaveLength(5)
		expect(result.series.map((series) => series.recordId)).toEqual([1, 2, 3, 4, 5])
		expect(result.series[2]?.viewer).toBe(true)
		expect(result.series[2]?.viewerComparison).toBe(false)
	})

	it('excludes malformed and checkpoint-incompatible splits without requiring speeds', () => {
		const result = buildLevelSplitAnalysis([
			{ id: 1, time: 10, splits: [4, 10], speeds: [80, 90] },
			{ id: 2, time: 11, splits: [4, 8, 11], speeds: [80, 85, 90] },
			{ id: 3, time: 12, splits: [5, null], speeds: [75, 80] },
			{ id: 4, time: 13, splits: [5, 13], speeds: [75] },
		])
		expect(result.series.map((series) => series.recordId)).toEqual([1, 4])
		expect(result.series[1]?.speeds).toEqual([null, null, null])
	})

	it('passes per-series dash arrays to both charts and mirrors viewer style in the legend', () => {
		expect(component.match(/:line-dash-array="lineDashArray"/g)).toHaveLength(2)
		expect(component).toContain('player.viewer ? [2, 4] : []')
		expect(component).toContain("player.viewer ? 'border-dotted' : 'border-solid'")
		expect(component).toContain('showViewerComparison?: boolean')
		expect(component).toContain('props.showViewerComparison')
		expect(component).not.toContain('<UButton')
		expect(component).toContain(':data="visibleDeltaData"')
		expect(component).toContain(':data="visibleSpeedData"')
		expect(component).toContain('finish: string')
		expect(component).toContain('props.labels.finish')
		expect(component).not.toContain('point[player.key] ?? 0')
	})

	it('places comparison toggle in section header and controls appended viewer series', () => {
		expect(toggle).toContain('<UButton')
		expect(toggle).toContain(':aria-pressed="modelValue"')
		expect(toggle).toContain("$emit('update:modelValue', !modelValue)")
		expect(page).toContain('<LevelSplitComparisonToggle')
		expect(page).toContain('v-model="showViewerSplitComparison"')
		expect(page).toContain(':show-viewer-comparison="showViewerSplitComparison"')
		expect(page.indexOf('<LevelSplitComparisonToggle')).toBeGreaterThan(
			page.indexOf('id="split-analysis-heading"'),
		)
		expect(page.indexOf('<LevelSplitComparisonToggle')).toBeLessThan(
			page.indexOf('<DataState', page.indexOf('id="split-analysis-heading"')),
		)
	})
})
