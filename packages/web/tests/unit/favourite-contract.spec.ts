import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function appSource(path: string) {
	return readFileSync(new URL(`../../app/${path}`, import.meta.url), 'utf8')
}

function serverSource(path: string) {
	return readFileSync(new URL(`../../server/${path}`, import.meta.url), 'utf8')
}

function querySource(path: string) {
	return readFileSync(
		new URL(`../../../graphql/documents/web/queries/${path}`, import.meta.url),
		'utf8',
	)
}

describe('favourite level integration', () => {
	it('renders signed-in pink heart actions beside playlist controls', () => {
		const button = appSource('components/level/FavouriteLevelButton.vue')
		const card = appSource('components/level/LevelCard.vue')
		const hero = appSource('components/level/LevelDetailHero.vue')
		const icons = appSource('utils/icons.ts')

		expect(button).toContain('v-if="session.user"')
		expect(button).toContain("favourited ? 'heart-off' : 'heart'")
		expect(button).toContain('text-pink-500')
		expect(button).toContain(':aria-label="accessibleLabel"')
		expect(button).toContain(':disabled="pending"')
		expect(card).toContain('class="mt-4 flex items-center gap-2"')
		expect(card).toContain('class="min-w-0 flex-1"')
		expect(card.indexOf('<PlaylistAddButton')).toBeLessThan(
			card.indexOf('<FavouriteLevelButton'),
		)
		expect(hero.indexOf('<PlaylistAddButton')).toBeLessThan(
			hero.indexOf('<FavouriteLevelButton'),
		)
		expect(icons).toContain('IconHeart')
		expect(icons).toContain('IconHeartOff')
	})

	it('uses shared optimistic state and no per-card GraphQL request', () => {
		const button = appSource('components/level/FavouriteLevelButton.vue')
		const state = appSource('composables/useLevelFavourite.ts')
		const card = appSource('components/level/LevelCard.vue')

		expect(button).toContain('useLevelFavouriteState()')
		expect(state).toContain("useState<FavouriteEntries>('level-favourite-entries'")
		expect(state).toContain('if (!current || current.pending) return')
		expect(state).toContain('runOptimisticFavouriteToggle')
		expect(state).toContain("method: previous ? 'DELETE' : 'PUT'")
		expect(state).toContain('revision.value += 1')
		expect(card).not.toContain('useQuery(')
		expect(card).not.toContain('useFetch(')
	})

	it('loads viewer state in every shared level source', () => {
		for (const query of [
			'levels.graphql',
			'adventure.graphql',
			'dashboard.graphql',
			'dashboardViewer.graphql',
			'userLevels.graphql',
			'levelDetail.graphql',
		]) {
			const source = querySource(query)
			expect(source).toContain('viewerFavourites: favourites')
			expect(source).toContain('$viewerId')
			expect(source).toContain('$includeViewer')
		}

		for (const composable of [
			'useLevels.ts',
			'useAdventure.ts',
			'useDashboard.ts',
			'useUserLevels.ts',
			'useLevelDetail.ts',
		]) {
			expect(appSource(`composables/${composable}`)).toContain('favourited:')
		}
	})

	it('proxies guarded authenticated mutations with exact backend bodies', () => {
		const addRoute = serverSource('api/favourite/[xxHash].put.ts')
		const removeRoute = serverSource('api/favourite/[xxHash].delete.ts')
		const backend = serverSource('utils/backend.ts')

		for (const route of [addRoute, removeRoute]) {
			expect(route).toContain('assertSameOrigin(event)')
			expect(route).toContain('body: { hash }')
			expect(route).toContain('setResponseStatus(event, 204)')
		}
		expect(addRoute).toContain("'/favourite/add'")
		expect(removeRoute).toContain("'/favourite/remove'")
		expect(backend).toContain('body?: Record<string, unknown>')
		expect(backend.match(/\.\.\.options/g)).toHaveLength(2)
	})

	it('adds deferred newest-first paginated profile favourites after Workshop Items', () => {
		const page = appSource('pages/user/[steamid].vue')
		const section = appSource('components/user/UserFavouriteLevelsSection.vue')
		const composable = appSource('composables/useUserFavouriteLevels.ts')
		const query = querySource('userLevels.graphql')

		expect(page.indexOf("value: 'workshop'")).toBeLessThan(page.indexOf("value: 'favourites'"))
		expect(page).toContain('<template #favourites>')
		expect(page).toContain('<LazyUserFavouriteLevelsSection')
		expect(section).toContain('<DataState')
		expect(section).toContain('<LevelGrid')
		expect(section).toContain('<CursorPagination')
		expect(composable).toContain("useCursorPagination(24, 'favourites')")
		expect(composable).toContain(
			'import.meta.server || userId.value === undefined || !toValue(active)',
		)
		expect(composable).toContain("requestPolicy: 'network-only'")
		expect(composable).toContain('userId.value !== viewerId.value')
		expect(composable).toContain('queriedLevels.value.filter')
		expect(composable).toContain('watch(favouriteState.revision')
		expect(query).toContain('query ZC_UserFavouriteLevels(')
		expect(query).toContain('filter: { level: { publiclyVisible: { equalTo: true } } }')
		expect(query).toContain('orderBy: [DATE_CREATED_DESC]')
	})
})
