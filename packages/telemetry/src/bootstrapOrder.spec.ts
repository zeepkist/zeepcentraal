import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const bootstraps = [
	['server', new URL('../../server/src/bootstrap.ts', import.meta.url), "import('./index')"],
	['jobs', new URL('../../jobs/src/index.ts', import.meta.url), "import('./jobsRuntime')"],
	['discord', new URL('../../discord/src/index.ts', import.meta.url), "import('./runtime')"],
	[
		'lobby-host',
		new URL('../../lobby-host/src/index.ts', import.meta.url),
		"import('./lobbyHostRuntime')",
	],
	[
		'migrate',
		new URL('../../database/src/migrate.ts', import.meta.url),
		"import('./migrateRuntime')",
	],
	[
		'postgraphile',
		new URL('../../postgraphile/src/bootstrap.ts', import.meta.url),
		"import('./index')",
	],
	[
		'web',
		new URL('../../web/runtime/telemetryBootstrap.ts', import.meta.url),
		"import(new URL('./index.mjs'",
	],
] as const

describe('telemetry bootstrap order', () => {
	for (const [name, file, runtimeImport] of bootstraps) {
		test(`${name} starts telemetry before runtime import`, () => {
			const source = readFileSync(file, 'utf8')
			expect(source.indexOf('startNodeTelemetry')).toBeGreaterThanOrEqual(0)
			expect(source.indexOf('startNodeTelemetry')).toBeLessThan(source.indexOf(runtimeImport))
			if (name === 'jobs') {
				const suppressLogs = source.indexOf("process.env.NO_LOG_SUCCESS = '1'")
				expect(suppressLogs).toBeGreaterThanOrEqual(0)
				expect(suppressLogs).toBeLessThan(source.indexOf(runtimeImport))
			}
		})
	}
})
