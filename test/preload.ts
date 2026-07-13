import { mock } from 'bun:test'

process.env.ZEEPCENTRAAL_TEST = '1'

const silentConsole = () => {}
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
	Object.defineProperty(console, method, {
		configurable: true,
		value: silentConsole,
		writable: true,
	})
}

const blockedFetch = Object.assign(
	async (input: Parameters<typeof fetch>[0]) => {
		throw new Error(`Unexpected external fetch in unit test: ${String(input)}`)
	},
	{
		preconnect(input: Parameters<typeof fetch.preconnect>[0]) {
			throw new Error(`Unexpected external preconnect in unit test: ${String(input)}`)
		},
	},
) satisfies typeof fetch

globalThis.fetch = blockedFetch

mock.module('postgres', () => ({
	default: () => {
		throw new Error('Unexpected postgres connection in unit test')
	},
}))

mock.module('graphile-worker', () => ({
	Logger: class TestLogger {
		private readonly log: (level: string, message: string, meta?: unknown) => void

		constructor(createLog: () => (level: string, message: string, meta?: unknown) => void) {
			this.log = createLog()
		}

		warn(message: string, meta?: unknown) {
			this.log('warning', message, meta)
		}
	},
	makeWorkerUtils: () => {
		throw new Error('Unexpected graphile-worker connection in unit test')
	},
	run: () => {
		throw new Error('Unexpected graphile-worker run in unit test')
	},
}))

class TestOtlpTraceExporter {
	export(_items: unknown, callback: (result: { code: number }) => void) {
		callback({ code: 0 })
	}

	forceFlush() {
		return Promise.resolve()
	}

	shutdown() {
		return Promise.resolve()
	}
}

class TestOtlpMetricExporter {
	export(_items: unknown, callback: (result: { code: number }) => void) {
		callback({ code: 0 })
	}

	forceFlush() {
		return Promise.resolve()
	}

	shutdown() {
		return Promise.resolve()
	}
}

mock.module('@opentelemetry/exporter-trace-otlp-grpc', () => ({
	OTLPTraceExporter: TestOtlpTraceExporter,
}))

mock.module('@opentelemetry/exporter-metrics-otlp-grpc', () => ({
	OTLPMetricExporter: TestOtlpMetricExporter,
}))
