import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GhostPlaybackFrame, LoadedPlaybackGhost } from '../../app/types/ghost'
import {
	buildRecordAirControlRuns,
	buildRecordAnalysisSummary,
	buildRecordCoachingSignals,
	buildRecordDriftRuns,
	buildRecordTelemetryCharts,
	buildRecordTimelineLanes,
} from '../../app/utils/recordGhostAnalysis'

function frame(
	time: number,
	x: number,
	overrides: Partial<GhostPlaybackFrame> = {},
): GhostPlaybackFrame {
	return {
		time,
		position: { x, y: 0, z: 0 },
		speed: 100 - time * 10,
		steering: 0.2,
		...overrides,
	}
}

function loaded(
	recordId: number,
	frames: GhostPlaybackFrame[],
	overrides: Partial<LoadedPlaybackGhost['record']> = {},
): LoadedPlaybackGhost {
	return {
		record: {
			recordId,
			levelId: 10,
			userId: recordId,
			userSteamId: String(recordId),
			userName: `Player ${recordId}`,
			time: frames.at(-1)?.time ?? 0,
			dateCreated: '2026-07-18T00:00:00Z',
			ghostUrl: `https://cdn.example/${recordId}`,
			mediaRevision: 'one',
			isWorldRecord: recordId === 1,
			isPersonalBest: true,
			...overrides,
		},
		ghost: {
			version: 6,
			metadata: {
				steamId: String(recordId),
				taggedUsername: null,
				color: '#ffffffff',
				cosmetics: null,
			},
			capabilities: {
				inputs: true,
				air: true,
				wheels: true,
				slip: true,
				state: true,
				surfaces: true,
				velocity: true,
				ragdoll: true,
				orientation: true,
			},
			frames,
		},
		identity: {
			recordId,
			userKey: String(recordId),
			playerName: `Player ${recordId}`,
			label: recordId === 1 ? 'Player 1 (WR)' : `Player ${recordId} (PB)`,
			isWorldRecord: recordId === 1,
			isPersonalBest: true,
			userRunOrdinal: null,
			bodyColor: recordId === 1 ? '#facc15' : '#38bdf8',
			colorSource: recordId === 1 ? 'world-record' : 'ghost',
		},
	}
}

describe('record ghost analysis', () => {
	it('builds bounded comparison chart samples and omits unsupported series', () => {
		const first = loaded(1, [
			frame(0, 0, { localVelocity: { x: 1, y: 0, z: 20 } }),
			frame(1, 10, { localVelocity: { x: 3, y: 0, z: 25 } }),
		])
		const second = loaded(2, [frame(0, 0), frame(1, 8)])
		const charts = buildRecordTelemetryCharts([first, second], 5)

		expect(charts.find((chart) => chart.key === 'speed')?.data).toHaveLength(5)
		expect(charts.find((chart) => chart.key === 'speed')?.series).toHaveLength(2)
		expect(charts.find((chart) => chart.key === 'lateral-velocity')?.series).toHaveLength(1)
		expect(charts.find((chart) => chart.key === 'speed')?.data[2]?.['record-1']).toBe(95)
	})

	it('samples telemetry at 5 Hz by default while preserving aligned interpolation', () => {
		const first = loaded(1, [frame(0, 0, { speed: 0 }), frame(1, 10, { speed: 100 })])
		const second = loaded(2, [frame(0, 0, { speed: 100 }), frame(1, 10, { speed: 0 })])
		const speed = buildRecordTelemetryCharts([first, second]).find(
			(chart) => chart.key === 'speed',
		)

		expect(speed?.data).toHaveLength(6)
		expect(speed?.data.map((point) => point.elapsed)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
		expect(speed?.data[1]).toMatchObject({ 'record-1': 20, 'record-2': 80 })
		expect(speed?.data.at(-1)).toMatchObject({
			elapsed: 1,
			'record-1': 100,
			'record-2': 0,
		})
	})

	it('caps default telemetry samples at 300 and preserves both endpoints', () => {
		const speed = buildRecordTelemetryCharts([
			loaded(1, [frame(0, 0, { speed: 20 }), frame(100, 1000, { speed: 120 })]),
		]).find((chart) => chart.key === 'speed')

		expect(speed?.data).toHaveLength(300)
		expect(speed?.data[0]).toMatchObject({ elapsed: 0, 'record-1': 20 })
		expect(speed?.data.at(-1)).toMatchObject({ elapsed: 100, 'record-1': 120 })
	})

	it('groups contiguous events into timeline lanes', () => {
		const lanes = buildRecordTimelineLanes([
			frame(0, 0, { braking: true, groundedWheelState: 15 }),
			frame(0.1, 1, { braking: true, groundedWheelState: 0 }),
			frame(0.2, 2, { braking: false, groundedWheelState: 0 }),
			frame(0.3, 3, { braking: false, groundedWheelState: 15 }),
		])

		expect(lanes.find((lane) => lane.kind === 'braking')?.events).toHaveLength(1)
		expect(lanes.find((lane) => lane.kind === 'airborne')?.events[0]?.start).toBe(0.1)
	})

	it('summarizes drift distance, duration and speed retention per run', () => {
		const ghost = loaded(1, [
			frame(0, 0, { slippingWheelState: 1, speed: 100 }),
			frame(0.2, 3, { slippingWheelState: 1, speed: 90 }),
			frame(0.4, 6, { slippingWheelState: 0, speed: 80 }),
		])
		const run = buildRecordDriftRuns([ghost])[0]

		expect(run?.eventCount).toBe(1)
		expect(run?.totalDistance).toBe(3)
		expect(run?.averageSpeedRetention).toBe(0.9)
		const summary = buildRecordAnalysisSummary(ghost)
		expect(summary.distance).toBe(6)
		expect(summary.driftCount).toBe(1)
	})

	it('keeps zero-slip comparisons available beside a run with detected slip', () => {
		const drifting = loaded(1, [
			frame(0, 0, { slippingWheelState: 1, speed: 100 }),
			frame(0.2, 3, { slippingWheelState: 1, speed: 90 }),
			frame(0.4, 6, { slippingWheelState: 0, speed: 80 }),
		])
		const clean = loaded(2, [
			frame(0, 0, { slippingWheelState: 0, speed: 100 }),
			frame(0.2, 3, { slippingWheelState: 0, speed: 100 }),
			frame(0.4, 6, { slippingWheelState: 0, speed: 100 }),
		])
		const runs = buildRecordDriftRuns([drifting, clean])

		expect(runs).toHaveLength(2)
		expect(runs[0]?.eventCount).toBe(1)
		expect(runs[1]).toMatchObject({ recordId: 2, eventCount: 0, totalDuration: 0 })
	})

	it('emits semantic coaching signals without presentation copy', () => {
		const primary = loaded(1, [
			frame(0, 0, { slippingWheelState: 1, speed: 100, steering: 0 }),
			frame(0.5, 3, { slippingWheelState: 1, speed: 70, steering: 0 }),
			frame(1, 6, { slippingWheelState: 0, speed: 70, steering: 0 }),
			frame(3.5, 20, { speed: 60, steering: 0 }),
		])
		const kinds = buildRecordCoachingSignals(primary).map((signal) => signal.kind)

		expect(kinds).toContain('drift-speed-loss')
		expect(kinds).toContain('low-input-section')
	})

	it('summarizes airborne input effects for every loaded ghost', () => {
		const halfTurn = Math.sin(Math.PI / 4)
		const first = loaded(1, [
			frame(0, 0, {
				groundedWheelState: 0,
				braking: true,
				armsUp: true,
				steering: -0.5,
				localAngularVelocity: { x: 0, y: 4, z: 0 },
				orientation: { x: halfTurn, y: 0, z: 0, w: halfTurn },
			}),
			frame(0.1, 1, {
				groundedWheelState: 0,
				braking: true,
				armsUp: true,
				steering: -0.5,
				localAngularVelocity: { x: 0, y: 2, z: 0 },
				orientation: { x: 0, y: 0, z: halfTurn, w: halfTurn },
				position: { x: 1, y: 2, z: 0 },
			}),
			frame(0.2, 2, {
				groundedWheelState: 0,
				braking: true,
				armsUp: true,
				steering: -0.5,
				localAngularVelocity: { x: 0, y: 0, z: 0 },
				orientation: { x: 0, y: 0, z: 0, w: 1 },
				position: { x: 2, y: 4, z: 0 },
			}),
			frame(0.3, 3, { groundedWheelState: 15, braking: false, armsUp: false }),
		])
		const unsupported = loaded(2, [frame(0, 0), frame(1, 1)])
		const runs = buildRecordAirControlRuns([first, unsupported], 1)

		expect(runs).toHaveLength(2)
		expect(runs[0]).toMatchObject({
			isPrimary: true,
			available: true,
			airborneDuration: 0.2,
			braking: { eventCount: 1, duration: 0.2, airborneShare: 1 },
			armsUp: { eventCount: 1, duration: 0.2, airborneShare: 1 },
			steeringLeft: { eventCount: 1, duration: 0.2, airborneShare: 1 },
		})
		expect(runs[0]?.medianBrakeAngularVelocityReduction).toBe(2)
		expect(runs[0]?.medianArmsUpVerticalTravel).toBe(4)
		expect(runs[0]?.medianSteeringLeftRotation).toBeCloseTo(Math.PI / 2)
		expect(runs[0]?.medianSteeringLeftRotationRate).toBeCloseTo(Math.PI / 2 / 0.2)
		expect(runs[1]).toMatchObject({ available: false, airborneDuration: null })
	})

	it('excludes airborne braking and flight from ground coaching signals', () => {
		const primary = loaded(1, [
			frame(0, 0, { speed: 100, steering: 0, groundedWheelState: 15 }),
			frame(2, 10, {
				speed: 100,
				steering: 0,
				groundedWheelState: 0,
				braking: true,
			}),
			frame(3, 20, {
				speed: 100,
				steering: 0,
				groundedWheelState: 0,
				braking: true,
			}),
			frame(4, 30, { speed: 100, steering: 0, groundedWheelState: 15 }),
			frame(6, 40, { speed: 100, steering: 0, groundedWheelState: 15 }),
		])
		const signals = buildRecordCoachingSignals(primary)

		expect(signals.some(({ kind }) => kind === 'late-braking')).toBe(false)
		const lowInput = signals.filter(({ kind }) => kind === 'low-input-section')
		expect(lowInput).toHaveLength(2)
		expect(lowInput).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ start: 0, end: 2 }),
				expect.objectContaining({ start: 4, end: 6 }),
			]),
		)
	})

	it('keeps a comparison speed deficit that reaches finish', () => {
		const primary = loaded(1, [frame(0, 0, { speed: 50 }), frame(2, 20, { speed: 50 })])
		const comparison = loaded(2, [frame(0, 0, { speed: 60 }), frame(2, 22, { speed: 60 })])
		const signal = buildRecordCoachingSignals(primary, comparison).find(
			(entry) => entry.kind === 'comparison-speed-deficit',
		)

		expect(signal?.start).toBe(0)
		expect(signal?.end).toBe(2)
		expect(signal?.value).toBe(10)
	})

	it('compares coaching speed at matched route progress instead of elapsed time', () => {
		const primary = loaded(1, [
			frame(0, 0, { speed: 50 }),
			frame(1, 50, { speed: 50 }),
			frame(2, 100, { speed: 50 }),
		])
		const comparison = loaded(2, [
			frame(0, 0, { speed: 60 }),
			frame(0.5, 50, { speed: 60 }),
			frame(1, 100, { speed: 20 }),
		])
		const signal = buildRecordCoachingSignals(primary, comparison).find(
			(entry) => entry.kind === 'comparison-speed-deficit',
		)

		expect(signal?.start).toBe(0)
		expect(signal?.end).toBe(1)
		expect(signal?.value).toBeGreaterThan(5)
	})

	it('keeps analysis components request-free and uses shared chart tooltip', () => {
		const files = [
			'RecordTelemetryOverview.vue',
			'RecordTelemetryCharts.vue',
			'RecordEventTimeline.vue',
			'RecordDriftAnalysis.vue',
			'RecordCoachingInsights.vue',
			'RecordCapabilityNotice.vue',
			'RecordAirControlAnalysis.vue',
			'RecordAnalysisTabs.vue',
		]
		for (const file of files) {
			const source = readFileSync(
				new URL(`../../app/components/record/${file}`, import.meta.url),
				'utf8',
			)
			expect(source).not.toMatch(/\$fetch|useFetch|useAsyncData|useQuery/)
		}
		const chartSource = readFileSync(
			new URL('../../app/components/record/RecordTelemetryCharts.vue', import.meta.url),
			'utf8',
		)
		const driftSource = readFileSync(
			new URL('../../app/components/record/RecordDriftAnalysis.vue', import.meta.url),
			'utf8',
		)
		expect(chartSource).toContain('<DashboardChartTooltip')
		expect(chartSource).toContain('color: props.primaryColor')
		expect(driftSource).toContain('<BarChart')
		expect(driftSource).toContain('<DashboardChartTooltip')
		expect(driftSource).toContain('color: props.primaryColor')
	})

	it('supports accessible shared focus and directional steering axes', () => {
		const source = readFileSync(
			new URL('../../app/components/record/RecordTelemetryCharts.vue', import.meta.url),
			'utf8',
		)

		expect(source).toContain('type="button"')
		expect(source).toContain(':aria-pressed="focusedSeriesKey === series.key"')
		expect(source).toContain('@click="toggleSeriesFocus(series.key)"')
		expect(source).toContain('focus-visible:ring-2')
		expect(source).toContain('const focusedSeriesKey = ref<string | null>(null)')
		expect(source).toContain('focusedSeriesKey.value === seriesKey ? null : seriesKey')
		expect(source).toContain(
			'if (!chartHasFocusedSeries(chart) || seriesKey === focusedSeriesKey.value) return color',
		)
		expect(source).toContain('colorWithOpacity(color, 0.25)')
		expect(source).toContain(':y-domain="yDomain(chart)"')
		expect(source).toContain(':y-explicit-ticks="yExplicitTicks(chart)"')
		expect(source).toContain("chart.key === 'steering' ? [-1, 1] : undefined")
		expect(source).toContain("chart.key === 'steering' ? [-1, 0, 1] : undefined")
		expect(source).toContain('props.labels.steeringLeftLabel')
		expect(source).toContain('props.labels.steeringRightLabel')
		expect(source).toContain('color: series.color')
		expect(source.slice(source.indexOf('function tooltipEntries'))).not.toContain(
			'focusedSeriesKey',
		)
	})

	it('uses an air-control comparison table with collapsed secondary effects', () => {
		const source = readFileSync(
			new URL('../../app/components/record/RecordAirControlAnalysis.vue', import.meta.url),
			'utf8',
		)

		expect(source).toContain('<table')
		expect(source).toContain('<thead')
		expect(source).toContain('<tbody')
		expect(source).toContain('<UCollapsible')
		expect(source).toContain('labels.detailsTitle')
		expect(source).toContain('labels.labels.airborneDuration')
		expect(source).toContain('labels.controls.braking.title')
		expect(source).toContain('labels.controls.armsUp.title')
		expect(source).toContain('labels.labels.airSteering')
		expect(source).toContain(':default-open="false"')
		expect(source).toContain('formatEventCount(run.braking)')
		expect(source).toContain('formatAirborneShare(run.braking)')
		expect(source).toContain('formatEventCount(run.armsUp)')
		expect(source).toContain('formatAirborneShare(run.armsUp)')
		expect(source).toContain('formatCompactEventSummary(run.steeringLeft)')
		expect(source).toContain('formatCompactEventSummary(run.steeringRight)')
		expect(source).toContain('run.medianBrakeAngularVelocityReduction')
		expect(source).toContain('run.medianBrakeUprightImprovement')
		expect(source).toContain('run.medianArmsUpVerticalTravel')
		expect(source).toContain('run.medianArmsUpUprightImprovement')
		expect(source).toContain('run.medianSteeringLeftRotation')
		expect(source).toContain('run.medianSteeringLeftRotationRate')
		expect(source).toContain('run.medianSteeringRightRotation')
		expect(source).toContain('run.medianSteeringRightRotationRate')
		expect(source).toContain(':class="run.isPrimary')
		expect(source).toContain(':style="{ backgroundColor: run.color }"')
		expect(source).toContain('{{ labels.observedLabel }}')
		expect(source).not.toContain('sm:grid-cols-2 xl:grid-cols-4')
	})

	it('combines drift comparison bars with a compact semantic summary table', () => {
		const source = readFileSync(
			new URL('../../app/components/record/RecordDriftAnalysis.vue', import.meta.url),
			'utf8',
		)

		expect(source).toContain('<BarChart')
		expect(source).toContain('orientation="horizontal"')
		expect(source).toContain('stacked')
		expect(source).toContain(':y-formatter="formatRunAxis"')
		expect(source).toContain('<DashboardChartTooltip')
		expect(source).toContain(':title="comparisonTooltipTitle(values)"')
		expect(source).toContain('<table')
		expect(source).toContain('<thead')
		expect(source).toContain('<tbody')
		expect(source).toContain('labels.labels.eventCount')
		expect(source).toContain('labels.labels.totalDuration')
		expect(source).toContain('labels.labels.totalDistance')
		expect(source).toContain('labels.labels.speedRetention')
		expect(source).toContain('labels.labels.worstRetention')
		expect(source).toContain(':style="{ backgroundColor: run.color }"')
		expect(source).toMatch(/run\.recordId\s*===\s*primaryRun\?\.recordId/)
		expect(source).toContain("'bg-primary/10 text-highlighted'")
		expect(source).toContain('runs.value.map((run, runIndex)')
		expect(source).toContain('runIndex,')
		expect(source).toContain('Object.fromEntries(')
		expect(source).toContain('? run.totalDuration : 0')
		expect(source).not.toContain('primaryMetrics')
		expect(source).not.toContain('hide-y-axis')
		expect(source).not.toContain('xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]')
	})

	it('marks unsupported persisted telemetry groups unavailable', () => {
		const modelSource = readFileSync(
			new URL('../../app/composables/useSingleRecordTelemetryModel.ts', import.meta.url),
			'utf8',
		)
		const panelSource = readFileSync(
			new URL('../../app/components/level/LevelTelemetryPanel.vue', import.meta.url),
			'utf8',
		)

		expect(modelSource).toContain("'surface-distance': value.hasSurfaceData === true")
		expect(modelSource).toContain('value.ghostVersion >= 6')
		expect(modelSource).toMatch(/hasExtendedEventTelemetry\s*\|\|\s*value\.hasAirData/)
		expect(modelSource).toContain('wheels: value.hasWheelData === true')
		expect(modelSource).toContain('unavailable: value.hasInputData !== true')
		expect(panelSource).toContain('v-if="chart.unavailable"')
		expect(panelSource).toContain('{{ model.unavailableLabel }}')
	})
})
