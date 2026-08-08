import { describe, expect, test } from 'bun:test'
import type { Meter } from '@opentelemetry/api'
import {
	RUNTIME_MEMORY_METRICS,
	readRuntimeMemoryMetrics,
	registerRuntimeMemoryMetrics,
} from './runtimeMetrics'

describe('runtime memory metrics', () => {
	test('maps every process memory field to byte gauges', () => {
		const measurements = readRuntimeMemoryMetrics({
			rss: 1,
			heapTotal: 2,
			heapUsed: 3,
			external: 4,
			arrayBuffers: 5,
		})

		expect(measurements.map(({ name, value }) => [name, value])).toEqual([
			['process.memory.rss', 1],
			['process.memory.heap.used', 3],
			['process.memory.heap.total', 2],
			['process.memory.external', 4],
			['process.memory.array_buffers', 5],
		])
	})

	test('registers each gauge once per meter with byte units', () => {
		const registrations: Array<{ name: string; unit: string | undefined }> = []
		const meter = {
			createObservableGauge(name: string, options?: { unit?: string }) {
				registrations.push({ name, unit: options?.unit })
				return { addCallback() {} }
			},
		} as unknown as Meter

		registerRuntimeMemoryMetrics(meter)
		registerRuntimeMemoryMetrics(meter)

		expect(registrations).toEqual(
			RUNTIME_MEMORY_METRICS.map(({ name }) => ({ name, unit: 'By' })),
		)
	})
})
