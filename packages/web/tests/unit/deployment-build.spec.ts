import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootPackage = JSON.parse(
	readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> }
const webPackage = JSON.parse(
	readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
	scripts: Record<string, string>
}
const nuxtConfig = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
const buildAction = readFileSync(
	new URL('../../../../.github/actions/build-package-binary/action.yml', import.meta.url),
	'utf8',
)
const deployWorkflow = readFileSync(
	new URL('../../../../.github/workflows/deploy.yml', import.meta.url),
	'utf8',
)

describe('web deployment build', () => {
	it('routes root CI build through standalone deployment compilation', () => {
		expect(rootPackage.scripts['build:web']).toBe(
			'bun --bun --cwd=packages/web run build:deployment',
		)
		expect(webPackage.scripts['build:deployment']).toContain(
			'--outfile ../../dist/zeepcentraal-web',
		)
		expect(webPackage.scripts['build:deployment']).toContain('--conditions=production')
		expect(webPackage.scripts['build:deployment']).toContain("--external 'chromium-bidi/*'")
	})

	it('bundles GraphQL into Nitro output for distroless compilation', () => {
		expect(nuxtConfig).toMatch(/externals:\s*\{\s*inline:\s*\['graphql'\]/)
	})

	it('restores source-aware Nuxt build data for web binaries only', () => {
		expect(buildAction).toMatch(/if: \$\{\{ inputs\.name == 'web' \}\}/)
		expect(buildAction).toContain('uses: actions/cache@v6')
		expect(buildAction).toContain('packages/web/node_modules/.cache/nuxt')
		expect(buildAction).toContain('packages/web/node_modules/.cache/vite')
		expect(buildAction).toContain('packages/web/.nuxt/cache')
		expect(buildAction).toContain('packages/web/.data')
		expect(buildAction).toContain('packages/web/app/**')
		expect(buildAction).toContain('packages/core/src/**')
		expect(buildAction).toContain('packages/database/src/**')
		expect(buildAction).toContain('restore-keys: |')
		expect(buildAction).not.toMatch(/^\s+packages\/web\/\.output$/m)
	})

	it('uses a supported Node runtime for semantic-release', () => {
		const releaseJob = deployWorkflow.slice(
			deployWorkflow.indexOf('\n  release:\n'),
			deployWorkflow.indexOf('\n  build-packages:\n'),
		)

		expect(releaseJob).toContain('uses: actions/setup-node@v7')
		expect(releaseJob).toContain("node-version: '26'")
		expect(releaseJob).toContain('package-manager-cache: false')
		expect(releaseJob.indexOf('Setup release Node')).toBeLessThan(
			releaseJob.indexOf('Run per-package semantic release'),
		)
	})
})
