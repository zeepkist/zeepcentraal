import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GhostPlaybackFrame, LoadedPlaybackGhost } from '../../app/types/ghost'
import {
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

	it('groups contiguous events into timeline lanes', () => {
		const lanes = buildRecordTimelineLanes([
			frame(0, 0, { braking: true, inAir: false }),
			frame(0.1, 1, { braking: true, inAir: true }),
			frame(0.2, 2, { braking: false, inAir: true }),
			frame(0.3, 3, { braking: false, inAir: false }),
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
		expect(chartSource).toContain('<DashboardChartTooltip')
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
		expect(modelSource).toContain('wheels: value.hasWheelData === true')
		expect(modelSource).toContain('unavailable: value.hasInputData !== true')
		expect(panelSource).toContain('v-if="chart.unavailable"')
		expect(panelSource).toContain('{{ model.unavailableLabel }}')
	})
})
