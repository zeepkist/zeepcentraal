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
})
