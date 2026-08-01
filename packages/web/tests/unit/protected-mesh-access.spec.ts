import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import {
	clearProtectedMeshAccessCaches,
	consumeRateLimit,
} from '../../server/utils/protectedMeshAccess'

const route = readFileSync(
	new URL('../../server/api/ghost-playback-assets/[levelId].get.ts', import.meta.url),
	'utf8',
)
const ghostModelRoute = readFileSync(
	new URL('../../server/api/ghost-playback-models.get.ts', import.meta.url),
	'utf8',
)
const config = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
const access = readFileSync(
	new URL('../../server/utils/protectedMeshAccess.ts', import.meta.url),
	'utf8',
)

describe('protected mesh access', () => {
	beforeEach(() => clearProtectedMeshAccessCaches())

	it('requires an authenticated ZeepCentraal session without checking game ownership', () => {
		expect(access).toContain('resolveVerifiedSession(')
		expect(access).toContain("await import('@zeepkist/database/services')")
		expect(access).not.toContain("from '@zeepkist/database/services'")
		expect(access).toContain("statusMessage: 'Authentication required'")
		expect(access).not.toContain('CheckAppOwnership')
		expect(access).not.toContain('steamPublisherApiKey')
	})

	it('enforces fixed-window request limits', () => {
		expect(consumeRateLimit('account', 2, 60_000, 1_000).allowed).toBe(true)
		expect(consumeRateLimit('account', 2, 60_000, 1_001).allowed).toBe(true)
		expect(consumeRateLimit('account', 2, 60_000, 1_002)).toEqual({
			allowed: false,
			retryAfter: 60,
		})
		expect(consumeRateLimit('account', 2, 60_000, 61_000).allowed).toBe(true)
	})

	it('keeps corpus server-only with same-origin route protection', () => {
		expect(route).toContain('assertSameOrigin(event)')
		expect(route).toContain('requireProtectedMeshAccess(event)')
		expect(route).toContain("'cache-control': 'private, no-store'")
		expect(config).toContain('NUXT_BLOCK_MESH_CORPUS_PATH')
		expect(config).not.toContain('NUXT_STEAM_PUBLISHER_API_KEY')
		expect(config).not.toContain('NUXT_PUBLIC_BLOCK_MESH_BASE_URL')
	})

	it('serves only common ghost models without requiring a login', () => {
		expect(ghostModelRoute).toContain('buildProtectedGhostModelBundle(')
		expect(ghostModelRoute).toContain('assertSameOrigin(event)')
		expect(ghostModelRoute).toContain("'cache-control': 'public,")
		expect(ghostModelRoute).not.toContain('requireProtectedMeshAccess')
	})
})
