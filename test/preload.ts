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

mock.module('@zeepkist/core/sql', () => ({
	createSqlClient: (_url: string, options: object) => {
		const blocked = () => {
			throw new Error('Unexpected Bun SQL connection in unit test')
		}
		return Object.assign(blocked, {
			options,
			unsafe: blocked,
			reserve: blocked,
			begin: blocked,
			listen: blocked,
			close: async () => {},
		})
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
