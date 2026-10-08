import type { Zc_RecordStatisticFragment } from '@zeepkist/graphql/generated'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useRecordTelemetryModel } from '../../app/composables/useLevelTelemetryModel'
import { useSingleRecordTelemetryModel } from '../../app/composables/useSingleRecordTelemetryModel'

beforeEach(() => {
	vi.stubGlobal('computed', computed)
	vi.stubGlobal('useRecordTelemetryModel', useRecordTelemetryModel)
	vi.stubGlobal('useI18n', () => ({ locale: ref('en'), t: (key: string) => key }))
})

afterEach(() => vi.unstubAllGlobals())

function modelFor(ghostVersion: number, fields: Partial<Zc_RecordStatisticFragment> = {}) {
	return useSingleRecordTelemetryModel(
		ref({ ghostVersion, hasSurfaceData: false, ...fields } as Zc_RecordStatisticFragment),
	)
}

describe('record surface telemetry availability', () => {
	it.each([6, 7, 8])('shows V%i samples despite stale capability flags', (version) => {
		const model = modelFor(version, { distanceOnWood: 10, timeOnWood: 1 }).value
		const distance = model.charts.find((chart) => chart.key === 'surface-distance')
		const time = model.charts.find((chart) => chart.key === 'surface-time')
		expect(distance?.unavailable).toBe(false)
		expect(time?.unavailable).toBe(false)
		expect(distance?.entries.find((entry) => entry.key === 'wood')?.value).toBe(10)
		expect(time?.entries.find((entry) => entry.key === 'wood')?.value).toBe(1)
	})

	it.each([7, 8])('shows empty V%i surfaces without inventing tarmac', (version) => {
		for (const hasSurfaceData of [false, null]) {
			const model = modelFor(version, { hasSurfaceData }).value
			for (const chart of model.charts.filter((chart) => chart.key.startsWith('surface-'))) {
				expect(chart.unavailable).toBe(false)
				expect(chart.entries.every((entry) => entry.value === 0)).toBe(true)
			}
			expect(model.emptyLabel).toBe('pages.recordDetail.telemetry.empty')
		}
	})

	it('keeps unsupported V5 surfaces unavailable', () => {
		const model = modelFor(5).value
		expect(model.charts.filter((chart) => chart.key.startsWith('surface-'))).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'surface-distance', unavailable: true }),
				expect.objectContaining({ key: 'surface-time', unavailable: true }),
			]),
		)
	})

	it.each([5, 6, 7, 8])('preserves field-specific V%i availability', (version) => {
		const model = modelFor(version, {
			hasInputData: false,
			hasWheelData: false,
			hasVelocityData: false,
			averageSpeed: 0,
		}).value
		expect(model.charts.find((chart) => chart.key === 'wheels')?.unavailable).toBe(true)
		expect(model.driverInputs.unavailable).toBe(true)
		expect(model.overviewMetrics.find((metric) => metric.key === 'average-speed')?.value).toBe(
			'common.unavailable',
		)
	})
})
