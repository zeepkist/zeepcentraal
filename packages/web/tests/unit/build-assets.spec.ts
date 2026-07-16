import { describe, expect, it } from 'vitest'
import { getBuildAssetsDir, normalizeBuildRevision } from '../../config/buildAssets'

describe('build asset namespace', () => {
	it('uses a stable namespace for local builds', () => {
		expect(getBuildAssetsDir()).toBe('/_nuxt/local/')
	})

	it('uses the CI artifact revision in the asset directory', () => {
		expect(getBuildAssetsDir('ABC123-456-2')).toBe('/_nuxt/abc123-456-2/')
	})

	it('normalizes unsafe path characters', () => {
		expect(normalizeBuildRevision(' release/web @ 1.0.0 ')).toBe('release-web-1-0-0')
	})
})
