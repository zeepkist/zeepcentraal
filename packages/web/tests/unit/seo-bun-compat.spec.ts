import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const seoEntry = Bun.resolveSync('@nuxtjs/seo', webRoot)
const imageEntry = Bun.resolveSync('nuxt-og-image', webRoot)
const entries = [
	['nuxt-og-image', imageEntry],
	['nuxt-ai-ready', Bun.resolveSync('nuxt-ai-ready', dirname(seoEntry))],
	['nuxtseo-devtools-host', Bun.resolveSync('nuxtseo-devtools-host', webRoot)],
	['nuxtseo-shared', Bun.resolveSync('nuxtseo-shared/kit', dirname(seoEntry))],
	['nuxtseo-shared', Bun.resolveSync('nuxtseo-shared/kit', dirname(imageEntry))],
] as const

describe('Bun SEO package metadata compatibility', () => {
	for (const [name, entry] of entries) {
		test(`resolves ${name} metadata without Node findPackageJSON`, async () => {
			const url = entry.startsWith('file:') ? new URL(entry) : pathToFileURL(entry)
			const { findPackageJSON } = await import(new URL('./findPackageJSON.mjs', url).href)
			const manifest = findPackageJSON('./', url)
			expect(JSON.parse(readFileSync(manifest, 'utf8')).name).toBe(name)
			const absoluteManifest = new URL('../package.json', url)
			expect(findPackageJSON(absoluteManifest)).toBe(manifest)
			const nuxtManifest = findPackageJSON(
				'nuxt',
				new URL('../../package.json', import.meta.url),
			)
			expect(JSON.parse(readFileSync(nuxtManifest, 'utf8')).name).toBe('nuxt')
			expect(() => findPackageJSON('missing-seo-fixture-package', url)).toThrow()
		})
	}
})
