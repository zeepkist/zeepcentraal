import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	isTrustedModkistDownloadUrl,
	MODKIST_RELEASES_URL,
	mapGitHubModkistReleases,
	resolveModkistDownloadUrl,
} from '../../server/utils/githubModkist'

const clientSource = readFileSync(
	new URL('../../server/utils/githubModkist.ts', import.meta.url),
	'utf8',
)
const metadataEndpoint = readFileSync(
	new URL('../../server/api/modkist/releases.get.ts', import.meta.url),
	'utf8',
)
const downloadEndpoint = readFileSync(
	new URL('../../server/api/downloads/modkist/[channel]/[format].get.ts', import.meta.url),
	'utf8',
)

const prerelease = {
	name: 'Modkist 1.0 RC 1',
	tagName: 'v1.0.0-rc.1',
	url: 'https://github.com/Thundernerd/ModkistMKII/releases/tag/v1.0.0-rc.1',
	publishedAt: '2026-07-01T00:00:00Z',
	isDraft: false,
	isPrerelease: true,
	releaseAssets: {
		nodes: [
			{
				name: 'Modkist_1.0.0-rc.1_x64_en-US.msi',
				downloadUrl:
					'https://github.com/Thundernerd/ModkistMKII/releases/download/v1.0.0-rc.1/Modkist.msi',
				contentType: 'application/octet-stream',
				size: 42,
			},
			{
				name: 'Modkist_1.0.0-rc.1_amd64.AppImage',
				downloadUrl:
					'https://github.com/Thundernerd/ModkistMKII/releases/download/v1.0.0-rc.1/Modkist.AppImage',
				contentType: 'application/octet-stream',
				size: 84,
			},
			{
				name: 'Modkist_1.0.0-rc.1_amd64.deb',
				downloadUrl:
					'https://github.com/Thundernerd/ModkistMKII/releases/download/v1.0.0-rc.1/Modkist.deb',
				contentType: 'application/vnd.debian.binary-package',
				size: 21,
			},
			{
				name: 'Modkist_1.0.0-rc.1_universal.dmg',
				downloadUrl:
					'https://github.com/Thundernerd/ModkistMKII/releases/download/v1.0.0-rc.1/Modkist.dmg',
				contentType: 'application/x-apple-diskimage',
				size: 63,
			},
		],
	},
}

describe('Modkist GitHub releases', () => {
	it('maps release assets and uses prerelease when no stable release exists', () => {
		const result = mapGitHubModkistReleases({
			repository: { latestRelease: null, releases: { nodes: [prerelease] } },
		})

		expect(result.stable?.tagName).toBe('v1.0.0-rc.1')
		expect(result.prerelease?.tagName).toBe('v1.0.0-rc.1')
		expect(Object.keys(result.stable?.assets ?? {}).sort()).toEqual([
			'appimage',
			'deb',
			'dmg',
			'msi',
		])
	})

	it('allows only fixed-repository GitHub release downloads', () => {
		expect(
			isTrustedModkistDownloadUrl(
				'https://github.com/Thundernerd/ModkistMKII/releases/download/v1/file.msi',
			),
		).toBe(true)
		expect(isTrustedModkistDownloadUrl('https://evil.example/file.msi')).toBe(false)
		expect(
			isTrustedModkistDownloadUrl(
				'https://github.com/Thundernerd/another-repository/releases/download/v1/file.msi',
			),
		).toBe(false)
	})

	it('falls back to releases page for absent assets', () => {
		expect(resolveModkistDownloadUrl(null, 'stable', 'msi')).toBe(MODKIST_RELEASES_URL)
	})

	it('keeps credentials server-only, caches requests, and protects endpoints', () => {
		expect(clientSource).toContain('useRuntimeConfig().githubToken')
		expect(clientSource).toContain('authorization: `Bearer ${token}`')
		expect(clientSource).toContain("getSharedCached('web:github:modkist-releases'")
		expect(clientSource).toContain("operationName: 'ZeepCentraal_ModkistReleases'")
		expect(clientSource).toContain('releaseAssets(first: 50)')
		expect(metadataEndpoint).toContain('assertSameOrigin(event)')
		expect(downloadEndpoint).toContain('assertSameOrigin(event)')
		expect(downloadEndpoint).toContain('MODKIST_RELEASE_CHANNELS')
		expect(downloadEndpoint).toContain('MODKIST_RELEASE_FORMATS')
	})
})
