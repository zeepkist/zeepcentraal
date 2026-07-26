import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

const repositoryRoot = new URL('../', import.meta.url)
const releaseConfig = readFileSync(new URL('release.config.cjs', repositoryRoot), 'utf8')
const packageNames = [
	'core',
	'database',
	'graphql',
	'import-zsl',
	'jobs',
	'postgraphile',
	'server',
	'telemetry',
	'web',
	'workshop',
]

function readPackage(relativePath: string): {
	version?: string
	scripts?: Record<string, string>
	devDependencies?: Record<string, string>
} {
	return JSON.parse(readFileSync(new URL(relativePath, repositoryRoot), 'utf8'))
}

describe('unified releases', () => {
	test('runs semantic-release once from the repository root', () => {
		const rootPackage = readPackage('package.json')

		expect(rootPackage.scripts?.release).toBe('semantic-release')
		expect(
			Object.keys(rootPackage.scripts ?? {}).filter((script) =>
				script.startsWith('release:'),
			),
		).toEqual([])
		expect(rootPackage.devDependencies?.['semantic-release-monorepo']).toBeUndefined()
		expect(releaseConfig).toContain("branches: ['develop']")
		expect(releaseConfig).toContain(["tagFormat: '", '$', "{version}'"].join(''))
	})

	test('keeps private workspace packages outside independent release streams', () => {
		for (const packageName of packageNames) {
			const packagePath = `packages/${packageName}`
			const packageManifest = readPackage(`${packagePath}/package.json`)

			expect(packageManifest.version).toBeUndefined()
			expect(packageManifest.scripts?.release).toBeUndefined()
			expect(existsSync(new URL(`${packagePath}/.releaserc.cjs`, repositoryRoot))).toBe(false)
		}
	})
})
