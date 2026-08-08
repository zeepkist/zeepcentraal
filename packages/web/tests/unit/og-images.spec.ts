import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const webRoot = fileURLToPath(new URL('../..', import.meta.url))
const appRoot = join(webRoot, 'app')
const ogImageRoot = join(appRoot, 'components/OgImage')
const composablesRoot = join(appRoot, 'composables')
const graphqlQueriesRoot = join(webRoot, '../graphql/documents/web/queries')

const expectedEntries = [
	'AdventureSeries',
	'CosmeticDetail',
	'Cosmetics',
	'Dashboard',
	'Developer',
	'DeveloperGraphql',
	'LevelDetail',
	'LevelExplorer',
	'ModDetail',
	'ModExplorer',
	'Privacy',
	'Records',
	'Settings',
	'SuperLeague',
	'SuperLeagueLevel',
	'SuperLeagueRound',
	'SuperLeagueSeason',
	'Terms',
	'TrackTournament',
	'UserDetail',
	'UserRankings',
	'WikiContent',
	'WikiIndex',
] as const

const routeEntries = [
	['pages/adventure/[series].vue', 'AdventureSeries'],
	['pages/cosmetic/[id].vue', 'CosmeticDetail'],
	['pages/cosmetics/index.vue', 'Cosmetics'],
	['pages/index.vue', 'Dashboard'],
	['pages/developer/index.vue', 'Developer'],
	['pages/developer/graphql.vue', 'DeveloperGraphql'],
	['pages/level/[xxh128].vue', 'LevelDetail'],
	['pages/levels.vue', 'LevelExplorer'],
	['pages/mod/[slug].vue', 'ModDetail'],
	['pages/mods.vue', 'ModExplorer'],
	['pages/privacy.vue', 'Privacy'],
	['pages/settings/index.vue', 'Settings'],
	['pages/settings/discord.vue', 'Settings'],
	['pages/super-league/index.vue', 'SuperLeague'],
	['pages/super-league/[seasonSlug]/[roundSlug]/[levelSlug].vue', 'SuperLeagueLevel'],
	['pages/super-league/[seasonSlug]/[roundSlug]/index.vue', 'SuperLeagueRound'],
	['pages/super-league/[seasonSlug]/index.vue', 'SuperLeagueSeason'],
	['pages/terms.vue', 'Terms'],
	['pages/totm/[slug].vue', 'TrackTournament', 1],
	['pages/totm/index.vue', 'TrackTournament', 1],
	['pages/totw/[slug].vue', 'TrackTournament', 0],
	['pages/totw/index.vue', 'TrackTournament', 0],
	['pages/user/[steamid].vue', 'UserDetail'],
	['pages/users.vue', 'UserRankings'],
	['pages/wiki/[...slug].vue', 'WikiContent'],
	['pages/wiki/index.vue', 'WikiIndex'],
] as const

function source(path: string): string {
	return readFileSync(join(appRoot, path), 'utf8')
}

function filesUnder(path: string, extension: string): string[] {
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(path, entry.name)
		if (entry.isDirectory()) return filesUnder(fullPath, extension)
		return extname(entry.name) === extension ? [fullPath] : []
	})
}

function componentPropContract(componentSource: string): string {
	const matches = [...componentSource.matchAll(/\bdefineProps<\{([\s\S]*?)\}>\(\)/g)]
	expect(matches).toHaveLength(1)
	return (matches[0]?.[1] ?? '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '')
		.replace(/[\s;,]/g, '')
}

function ogImplementationSources(): Array<readonly [string, string]> {
	const entries = readdirSync(ogImageRoot)
		.filter((file) => file.endsWith('.takumi.vue'))
		.map(
			(file) =>
				[
					`components/OgImage/${file}`,
					readFileSync(join(ogImageRoot, file), 'utf8'),
				] as const,
		)
	const composables = readdirSync(composablesRoot)
		.filter((file) => /^useOg.*\.ts$/.test(file))
		.map(
			(file) =>
				[`composables/${file}`, readFileSync(join(composablesRoot, file), 'utf8')] as const,
		)
	return [...entries, ...composables]
}

describe('OG image component contracts', () => {
	test('provides the expected unique Takumi entries', () => {
		const actual = readdirSync(ogImageRoot)
			.filter((file) => file.endsWith('.takumi.vue'))
			.map((file) => file.slice(0, -'.takumi.vue'.length))
			.toSorted()

		expect(actual).toEqual([...expectedEntries].toSorted())
	})

	test('keeps OG island props explicit and never reads route state', () => {
		for (const component of expectedEntries) {
			const componentSource = readFileSync(
				join(ogImageRoot, `${component}.takumi.vue`),
				'utf8',
			)

			expect(componentPropContract(componentSource), component).toBe(
				component === 'TrackTournament' ? 'slug:stringtype:0|1' : 'slug:string',
			)
			expect(componentSource, component).not.toMatch(/\buseRoute\s*\(/)
			expect(componentSource, component).not.toMatch(/\bconst\s+slug\s*=/)
			expect(componentSource, component).toContain('<OgFrame')
			expect(componentSource, component).toMatch(/style="[^"]*\bfont-family:\s*DINish(?:;|")/)
		}
	})

	test('keeps branding, typography, and numeric alignment in shared primitives', () => {
		const frame = source('components/OgFrame.vue')
		const metrics = source('components/OgMetrics.vue')
		const podium = source('components/OgPodium.vue')
		const css = source('assets/css/tailwind.css')

		expect(frame).toContain('src="/android-chrome-192x192.png"')
		expect(frame).toContain("$t('common.brand')")
		expect(frame).toContain('font-family: DINish')
		expect(frame).toContain('font-variant-numeric: tabular-nums')
		expect(frame).toContain("font-feature-settings: 'tnum' 1")
		expect(frame).toContain("import { normaliseOgImageUrl } from '~/utils/ogImage'")
		expect(frame).toContain("import { computed } from 'vue'")
		expect(css).toContain('--font-sans: "DINish", sans-serif;')
		expect(css).toMatch(
			/@font-face\s*\{[\s\S]*?font-family:\s*"DINish";[\s\S]*?font-style:\s*normal;/,
		)

		for (const numericPrimitive of [metrics, podium]) {
			expect(numericPrimitive).toContain('tabular-nums')
			expect(numericPrimitive).toContain('font-variant-numeric: tabular-nums')
			expect(numericPrimitive).toContain("font-feature-settings: 'tnum' 1")
		}
	})

	test('leaves generic page SEO free of a competing OG renderer', () => {
		const pageSeo = source('composables/usePageSeo.ts')

		expect(pageSeo).not.toContain('defineOgImage')
		expect(pageSeo).not.toContain('ZeepCentraal.takumi')
	})
})

describe('OG image route wiring', () => {
	test('publishes one shared Records card from records and record detail routes', () => {
		const recordsRoute = source('pages/records/index.vue')
		const recordRoute = source('pages/record/[recordId].vue')
		const sharedImage = source('composables/useRecordsOgImage.ts')
		const sharedImagePlugin = source('plugins/records-og-image.server.ts')

		expect(recordsRoute).toContain('useRecordsOgImage()')
		expect(recordRoute).toContain('useRecordsOgImage()')
		expect(recordsRoute).not.toContain('defineOgImage(')
		expect(recordRoute).not.toContain('defineOgImage(')
		expect(sharedImage).toContain("RECORDS_OG_PAGE_PATH = '/records'")
		expect(sharedImage).toContain("component: 'RecordsTakumi'")
		expect(sharedImage).toContain("props: { slug: 'records' }")
		expect(sharedImage).toContain("cacheKey: 'records-card'")
		expect(sharedImage).not.toContain('getOgImagePath(')
		expect(sharedImagePlugin).toContain('_path: RECORDS_OG_PAGE_PATH')
		expect(sharedImagePlugin).toContain('buildOgImageUrl(')
		expect(sharedImagePlugin).toContain('useState(RECORDS_OG_STATE_KEY, () => path)')
	})

	test('wires each route to its dedicated component with only a slug prop', () => {
		for (const [route, component, type] of routeEntries) {
			const routeSource = source(route)
			const calls = [
				...routeSource.matchAll(
					/\bdefineOgImage\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*slug(?=\s*[:,}])/g,
				),
			].map((match) => match[1])

			expect(calls, route).toEqual([`${component}.takumi`])
			if (type !== undefined) {
				expect(routeSource, route).toContain(`type: ${type}`)
			}
		}

		const userRoute = source('pages/user/[steamid].vue')
		expect(userRoute).toContain(
			'const ogSteamId = computed(() => preserveOgStringProp(steamId.value))',
		)
		expect(userRoute).toContain("defineOgImage('UserDetail.takumi', { slug: ogSteamId })")
	})

	test('defines one renderer call for every public route pattern', () => {
		const calls = filesUnder(join(appRoot, 'pages'), '.vue').flatMap((file) =>
			[...readFileSync(file, 'utf8').matchAll(/\bdefineOgImage\(\s*['"]([^'"]+)['"]/g)].map(
				(match) => match[1],
			),
		)

		expect(calls.toSorted()).toEqual(
			routeEntries.map(([, component]) => `${component}.takumi`).toSorted(),
		)
	})
})

describe('OG image data-source contracts', () => {
	test('uses Nuxt Content only for content-backed OG data', () => {
		const content = source('composables/useOgContentData.ts')
		const developerGraphql = source('components/OgImage/DeveloperGraphql.takumi.vue')

		expect(content).toContain("queryCollection('wiki')")
		expect(content).toContain("queryCollection('legal')")
		expect(content).not.toMatch(/\buseQuery\s*\(|\buseFetch\s*\(|\$fetch\s*\(/)
		expect(developerGraphql).toContain("queryCollection('developer')")
		expect(developerGraphql).not.toMatch(/\buseQuery\s*\(|\buseFetch\s*\(|\$fetch\s*\(/)
	})

	test('reuses generated GraphQL documents without inline operations', () => {
		for (const [file, implementationSource] of ogImplementationSources()) {
			expect(implementationSource, file).not.toMatch(/from\s+['"][^'"]+\.graphql['"]/)
			expect(implementationSource, file).not.toMatch(
				/\b(?:query|mutation|subscription)\s+ZC_/,
			)

			if (implementationSource.includes('useQuery(')) {
				expect(implementationSource, file).toContain("from '@zeepkist/graphql/generated'")
			}
			if (implementationSource.includes('queryCollection(')) {
				expect([
					'components/OgImage/DeveloperGraphql.takumi.vue',
					'composables/useOgContentData.ts',
				]).toContain(file)
			}
		}
	})

	test('keeps non-GraphQL requests on same-origin Nitro routes', () => {
		for (const [file, implementationSource] of ogImplementationSources()) {
			const requests = [
				...implementationSource.matchAll(
					/\b(?:useFetch|\$fetch)(?:<[^>]+>)?\s*\(\s*([`'"])([^`'"]+)\1/g,
				),
			].map((match) => match[2] ?? '')

			for (const request of requests) {
				expect(request, file).toMatch(/^\/api\//)
			}
		}
	})

	test('matches dashboard and live-record labels to their returned count fields', () => {
		const dashboard = source('components/OgImage/Dashboard.takumi.vue')
		const records = source('components/OgImage/Records.takumi.vue')

		expect(dashboard).toContain('critical?.rankedUsers?.totalCount')
		expect(dashboard).toContain('critical?.totalUsers?.totalCount')
		expect(records).toContain('data?.recordsDay?.totalCount')
		expect(records).toContain('data?.personalBestGlobalsDay?.totalCount')
		expect(records).toContain('data?.worldRecordGlobalsDay?.totalCount')
		expect(records).toContain("t('dashboard.metrics.past24Hours')")
	})

	test('uses bounded dense standings layouts for stacked leaderboard renderers', () => {
		for (const component of [
			'SuperLeagueSeason',
			'SuperLeagueRound',
			'SuperLeagueLevel',
			'TrackTournament',
		]) {
			const componentSource = source(`components/OgImage/${component}.takumi.vue`)
			expect(componentSource, component).toContain('\n\t\tdense\n')
			expect(componentSource, component).toContain('<OgStandings')
		}

		const frame = source('components/OgFrame.vue')
		expect(frame).toContain("'h-28 shrink-0 overflow-hidden'")
		expect(frame).toContain("'mt-3'")
	})

	test('shows only the latest three Super League seasons without aggregate counters', () => {
		const superLeague = source('components/OgImage/SuperLeague.takumi.vue')
		const eventData = source('composables/useOgEventData.ts')
		const seasonsQuery = readFileSync(join(graphqlQueriesRoot, 'zslSeasons.graphql'), 'utf8')

		expect(eventData).toContain('variables: { first: 3 }')
		expect(seasonsQuery).toContain('orderBy: [START_DATE_DESC]')
		expect(superLeague).toContain('v-for="season in data.seasons"')
		expect(superLeague).not.toContain('<OgMetrics')
		expect(superLeague).not.toContain('data.totalCount')
		expect(superLeague).not.toContain('Latest shown')
	})

	test('uses shared breadcrumbs and pinned explorer mod cards', () => {
		const developerGraphql = source('components/OgImage/DeveloperGraphql.takumi.vue')
		const modExplorer = source('components/OgImage/ModExplorer.takumi.vue')

		expect(developerGraphql).toContain('<OgBreadcrumbs :items="breadcrumbs"')
		expect(developerGraphql).not.toContain('const breadcrumb =')
		expect(modExplorer).toContain('(data.value?.items ?? []).slice(0, 3)')
		expect(modExplorer).toContain('v-for="mod in popularMods"')
		expect(modExplorer).toContain(':src="mod.imageUrl"')
		expect(modExplorer).not.toContain('mod.downloads')
		expect(modExplorer).not.toContain('pin=false')
	})
})
