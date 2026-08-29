import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'

process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = 'http'
const exporter = new InMemorySpanExporter()
const processor = new SimpleSpanProcessor(exporter)
const sdk = new NodeSDK({
	spanProcessors: [processor],
	instrumentations: [getNodeAutoInstrumentations()],
})
sdk.start()

const { exerciseNodeHttp } = await import('./httpRuntime')
await exerciseNodeHttp()
await processor.forceFlush()
const spans = exporter.getFinishedSpans().map(({ kind, name }) => ({ kind, name }))
await sdk.shutdown()
console.log(`OTEL_HTTP_SPANS=${JSON.stringify(spans)}`)
