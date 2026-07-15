import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MOD_SORTS } from '../../app/types/mod'
import {
	GTR_MOD_SLUG,
	getModPageWindow,
	getVisibleModTags,
	MOD_PAGE_SIZE,
	MODIO_SORTS,
	normalizeModPage,
	normalizeModSearch,
	normalizeModSlug,
	normalizeModSort,
} from '../../app/utils/modExplorer'
import { sanitizeModDescription } from '../../server/utils/sanitizeModDescription'

const listEndpoint = readFileSync(
	new URL('../../server/api/modio/mods.get.ts', import.meta.url),
	'utf8',
)
const detailEndpoint = readFileSync(
	new URL('../../server/api/modio/mods/[slug].get.ts', import.meta.url),
	'utf8',
)
const modioClient = readFileSync(new URL('../../server/utils/modio.ts', import.meta.url), 'utf8')
const sharedCache = readFileSync(
	new URL('../../server/utils/sharedCache.ts', import.meta.url),
	'utf8',
)
const explorerPage = readFileSync(new URL('../../app/pages/mods.vue', import.meta.url), 'utf8')
const detailPage = readFileSync(new URL('../../app/pages/mod/[slug].vue', import.meta.url), 'utf8')
const modCard = readFileSync(
	new URL('../../app/components/mod/ModCard.vue', import.meta.url),
	'utf8',
)

describe('mod explorer input normalization', () => {
	it('defaults invalid URL state and bounds search text', () => {
		expect(normalizeModPage('invalid')).toBe(1)
		expect(normalizeModPage('-4')).toBe(1)
		expect(normalizeModPage('3')).toBe(3)
		expect(normalizeModSort('invalid')).toBe(MOD_SORTS.popular)
		expect(normalizeModSearch(`  ${'a'.repeat(110)}  `)).toHaveLength(100)
	})

	it('validates canonical slug routes', () => {
		expect(normalizeModSlug('Zeepkist-GTR')).toBe(GTR_MOD_SLUG)
		expect(normalizeModSlug('../zeepkist-gtr')).toBeNull()
		expect(normalizeModSlug('spaces are invalid')).toBeNull()
	})

	it('maps every public sort to an allowed mod.io sort', () => {
		expect(Object.keys(MODIO_SORTS)).toEqual(Object.values(MOD_SORTS))
		expect(MODIO_SORTS.rating).toBe('-ratings_weighted_aggregate')
		expect(MODIO_SORTS.updated).toBe('-date_updated')
	})
})

describe('GTR pinning and pagination', () => {
	it('reserves one first-page slot without duplicating or skipping results', () => {
		expect(MOD_PAGE_SIZE).toBe(24)
		expect(getModPageWindow(1, true)).toEqual({ limit: 23, offset: 0 })
		expect(getModPageWindow(2, true)).toEqual({ limit: 24, offset: 23 })
		expect(getModPageWindow(3, true)).toEqual({ limit: 24, offset: 47 })
		expect(getModPageWindow(2, false)).toEqual({ limit: 24, offset: 24 })
	})

	it('pins only default popular results and excludes GTR from remaining pages', () => {
		expect(listEndpoint).toContain("search === '' && sort === 'popular'")
		expect(listEndpoint).toContain("'id-not-in': excludedId")
		expect(listEndpoint).toContain('[mapModioMod(pinnedMod), ...listed]')
		expect(listEndpoint).toContain('_limit: limit')
		expect(listEndpoint).toContain('_offset: offset')
	})
})

describe('private mod.io API boundary', () => {
	it('removes executable description markup and hardens external links', () => {
		const output = sanitizeModDescription(
			'<p onclick="alert(1)">Safe</p><script>alert(1)</script><a href="https://example.com">Link</a>',
		)
		expect(output).toContain('<p>Safe</p>')
		expect(output).not.toContain('script')
		expect(output).not.toContain('onclick')
		expect(output).toContain('target="_blank"')
		expect(output).toContain('rel="noopener noreferrer nofollow"')
	})

	it('keeps credentials server-only and enforces same-origin access', () => {
		expect(modioClient).toContain('config.modioApiKey')
		expect(modioClient).toContain("url.searchParams.set('api_key', apiKey)")
		expect(explorerPage).not.toContain('NUXT_MODIO_API_KEY')
		expect(listEndpoint).toContain('assertSameOrigin(event)')
		expect(detailEndpoint).toContain('assertSameOrigin(event)')
	})

	it('uses shared 15-minute caching for every external response', () => {
		expect(sharedCache).toContain('15 * 60 * 1_000')
		expect(modioClient).toContain('getSharedCached(cacheKey(path, params)')
		expect(modioClient).not.toContain('console.log')
	})

	it('resolves slug details and immediate dependencies server-side', () => {
		expect(detailEndpoint).toContain('findModBySlug(slug)')
		expect(detailEndpoint).toContain('/dependencies`')
		expect(detailEndpoint).toContain('{ recursive: false, _limit: 100 }')
		expect(detailPage).toContain('/api/modio/mods/' + '$' + '{slug}')
		expect(detailPage).toContain("query: { dependencies: 'true' }")
	})
})

describe('mod presentation', () => {
	it('hides system tags and promotes Essentials to first position', () => {
		expect(
			getVisibleModTags([
				'Plugin',
				'Humor',
				'Multiplayer',
				'Essentials',
				'Dependency',
				'Ghosts',
			]),
		).toEqual(['Essentials', 'Multiplayer', 'Ghosts'])
		expect(
			getVisibleModTags([' dependency ', 'PLUGIN', 'Utility', 'Timing', 'Ghosts', 'Extra']),
		).toEqual(['Utility', 'Timing', 'Ghosts'])
		expect(modCard).toContain(":color=\"isEssentialsTag(tag) ? 'primary' : 'neutral'\"")
		expect(modCard).toContain('class="absolute right-6 top-6')
		expect(modCard).not.toContain('top-[calc(56.25%+2rem)]')
	})

	it('uses slug detail links and a separate native mod.io action', () => {
		expect(modCard).toContain(':to="`/mod/' + '$' + '{mod.slug}`"')
		expect(modCard).toContain(':href="mod.profileUrl"')
		expect(modCard).toContain('target="_blank"')
		expect(modCard).toContain('name="plus"')
	})

	it('keeps components request-free', () => {
		expect(modCard).not.toContain('useFetch')
		expect(modCard).not.toContain('$fetch')
		expect(explorerPage).toContain('await useMods()')
	})
})
