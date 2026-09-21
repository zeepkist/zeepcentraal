import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const bootstraps = [
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
		})
	}
})
