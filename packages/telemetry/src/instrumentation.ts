import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

export function createNodeAutoInstrumentations() {
	return getNodeAutoInstrumentations({
		// Bun 1.3.x does not support node:v8.getHeapSpaceStatistics.
		'@opentelemetry/instrumentation-runtime-node': {
			enabled: false,
		},
	})
}
