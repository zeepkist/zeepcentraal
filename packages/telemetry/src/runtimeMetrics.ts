import type { Meter } from '@opentelemetry/api'
import { getMeter } from './span'

export const RUNTIME_MEMORY_METRICS = [
	{ name: 'process.memory.rss', key: 'rss', description: 'Resident set size' },
	{ name: 'process.memory.heap.used', key: 'heapUsed', description: 'Used JavaScript heap' },
	{ name: 'process.memory.heap.total', key: 'heapTotal', description: 'Total JavaScript heap' },
	{ name: 'process.memory.external', key: 'external', description: 'External memory' },
	{
		name: 'process.memory.array_buffers',
		key: 'arrayBuffers',
		description: 'Array buffer memory',
	},
] as const satisfies ReadonlyArray<{
	name: string
	key: keyof NodeJS.MemoryUsage
	description: string
}>

const registeredMeters = new WeakSet<Meter>()

export function readRuntimeMemoryMetrics(memoryUsage = process.memoryUsage()) {
	return RUNTIME_MEMORY_METRICS.map((metric) => ({
		...metric,
		value: memoryUsage[metric.key],
	}))
}

export function registerRuntimeMemoryMetrics(meter: Meter = getMeter('zeepcentraal-runtime')) {
	if (registeredMeters.has(meter)) return
	registeredMeters.add(meter)

	for (const metric of RUNTIME_MEMORY_METRICS) {
		const gauge = meter.createObservableGauge(metric.name, {
			description: metric.description,
			unit: 'By',
		})
		gauge.addCallback((result) => result.observe(process.memoryUsage()[metric.key]))
	}
}
