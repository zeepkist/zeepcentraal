import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const composable = readFileSync(
	new URL('../../app/composables/useDashboard.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
const app = readFileSync(new URL('../../app/app.vue', import.meta.url), 'utf8')
const viewerQuery = readFileSync(
	new URL('../../app/graphql/queries/dashboardViewer.graphql', import.meta.url),
	'utf8',
)

describe('dashboard critical SSR', () => {
	it('resolves session before rendering pages', () => {
		expect(app).toContain('await useCurrentUser()')
	})

	it('awaits critical data before creating rendered dashboard models', () => {
		expect(page).toContain('await dashboard.prefetchCritical()')
		expect(page.indexOf('await dashboard.prefetchCritical()')).toBeLessThan(
			page.indexOf('const hero = computed'),
		)
		expect(page).toContain('dashboard.criticalQuery.fetching.value')
		expect(page).toContain('dashboard.metrics.value')
		expect(page).toContain('dashboard.trendingLevels.value')
		expect(page).toContain('dashboard.popularLevelsQuery.fetching.value')
		expect(page.indexOf('trending-levels-heading')).toBeLessThan(
			page.indexOf('popular-levels-heading'),
		)
		expect(page.indexOf('popular-levels-heading')).toBeLessThan(
			page.indexOf('hot-levels-heading'),
		)
	})

	it('prefetches hero data only when a verified viewer exists', () => {
		const start = composable.indexOf('async function prefetchCritical()')
		const end = composable.indexOf('\n\treturn {', start)
		const prefetch = composable.slice(start, end)
		expect(prefetch).toContain('if (!import.meta.server) return')
		expect(prefetch).toContain('if (viewerId.value === undefined)')
		expect(prefetch).toContain('await criticalQuery')
		expect(prefetch).toContain('Promise.all([criticalQuery, viewerQuery])')
	})

	it('loads latest-season standing within the hero summary request', () => {
		expect(viewerQuery).toContain('zslSeasonResults(first: 1')
		expect(viewerQuery).toContain('userId: { equalTo: $id }')
		expect(viewerQuery).not.toContain('query ZC_DashboardHeroStanding')
		expect(composable).not.toContain('Zc_DashboardHeroStandingDocument')
	})

	it('preserves SSR metrics until a post-mount subscription snapshot arrives', () => {
		expect(composable).toContain("const ssrMetricWindows = useState('dashboard-metric-windows'")
		expect(composable).toContain('const liveMetricWindows = ref({ ...ssrMetricWindows.value })')
		expect(composable).toContain('variables: ssrMetricWindows')
		expect(composable).toContain('variables: liveMetricWindows')
		expect(composable).toContain('const metricsSubscriptionActive = ref(false)')
		expect(composable.indexOf('metricsSubscriptionActive.value = true')).toBeGreaterThan(
			composable.indexOf('onMounted(() => {'),
		)
		expect(composable).toContain('metricsLive.data.value?.query ?? criticalQuery.data.value')
		expect(composable).toContain('? liveMetricWindows.value.monthSince')
		expect(composable).toContain(': ssrMetricWindows.value.monthSince')
		expect(page).toContain(
			'formatDashboardMonth(dashboard.metricMonthSince.value, locale.value)',
		)
	})

	it('keeps remaining non-critical dashboard requests client-only', () => {
		expect(composable).toContain(
			'pause: computed(() => import.meta.server || !hotLevelsPrefetch.active.value)',
		)
		expect(composable).toContain(
			'pause: computed(() => import.meta.server || !popularLevelsPrefetch.active.value)',
		)
		expect(composable.match(/query: Zc_DashboardHotLevelsDocument/g)).toHaveLength(2)
		expect(composable).toContain(
			'variables: computed(() => ({ since: levelWindows.value.weekSince }))',
		)
		expect(composable).toContain(
			'variables: computed(() => ({ since: levelWindows.value.rollingMonthSince }))',
		)
		expect(composable).toContain('levelWindows.value = getDashboardLevelWindows()')
		expect(composable).toMatch(
			/import\.meta\.server\s*\|\|\s*viewerId\.value === undefined\s*\|\|\s*!viewerPrefetch\.active\.value/,
		)
		expect(composable).toContain(
			'pause: computed(() => import.meta.server || !statisticsPrefetch.active.value)',
		)
		expect(composable).toContain('server: false')
	})

	it('removes dashboard record feeds while retaining viewer workshop levels', () => {
		expect(viewerQuery).toContain('query ZC_DashboardViewerLevels')
		expect(viewerQuery).toContain('levelItems(')
		expect(viewerQuery).toContain('first: 6')
		expect(viewerQuery).toContain('level: { publiclyVisible: { equalTo: true } }')
		expect(viewerQuery).not.toContain('records(first: 5')
		expect(composable).toContain('Zc_DashboardViewerLevelsDocument')
		expect(composable).not.toContain('recordsPrefetch')
		expect(composable).not.toContain('Zc_RecentPersonalBestsDocument')
		expect(composable).not.toContain('Zc_RecentWorldRecordsDocument')
		expect(page).toContain('dashboard.viewerLevels')
		expect(page).not.toContain('dashboard.viewerRecords')
		expect(page).not.toContain('dashboard.worldRecords')
		expect(page).not.toContain('dashboard.personalBests')
		expect(page).not.toContain('DashboardRecordFeed')
	})
})
