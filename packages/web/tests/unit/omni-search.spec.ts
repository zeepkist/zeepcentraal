import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import type { OmniSearchLevelResult, OmniSearchUserResult } from '../../app/types/app'
import {
	OMNI_SEARCH_DEBOUNCE_MS,
	OMNI_SEARCH_MINIMUM_LENGTH,
	sortOmniSearchLevels,
	sortOmniSearchUsers,
} from '../../app/utils/omniSearch'

const query = readFileSync(
	new URL('../../../graphql/documents/web/queries/search.graphql', import.meta.url),
	'utf8',
)
const component = readFileSync(
	new URL('../../app/components/layout/HeaderOmniSearch.vue', import.meta.url),
	'utf8',
)

describe('header omni-search', () => {
	test('uses bounded ranked, unranked, and level searches', () => {
		expect(query).toContain('query ZC_OmniSearch($search: String!)')
		expect(query.match(/first: 6/g)).toHaveLength(2)
		expect(query).toContain('first: 8')
		expect(query).toContain('orderBy: [USER_POINTS_RANK_ASC, STEAM_NAME_ASC]')
		expect(query).toContain('orderBy: [STEAM_NAME_ASC]')
		expect(query).toContain('orderBy: [LEVEL_POINTS_POINTS_DESC, ID_ASC]')
		expect(query).toContain('rank: { greaterThan: 0 }')
		expect(query).toContain('{ userPointExists: false }')
		expect(query).toContain('name: { includesInsensitive: $search }')
		expect(query).toContain('votes(first: 0)')
	})

	test('places ranked users first and sorts equal ranks alphabetically', () => {
		const ranked: OmniSearchUserResult[] = [
			{ kind: 'user', id: 1, steamId: '1', name: 'Zulu', rank: 2 },
			{ kind: 'user', id: 2, steamId: '2', name: 'Alpha', rank: 2 },
			{ kind: 'user', id: 3, steamId: '3', name: 'First', rank: 1 },
		]
		const unranked: OmniSearchUserResult[] = [
			{ kind: 'user', id: 4, steamId: '4', name: 'Beta', rank: null },
			{ kind: 'user', id: 5, steamId: '5', name: 'Able', rank: null },
		]

		expect(sortOmniSearchUsers(ranked, unranked, 'en').map(({ name }) => name)).toEqual([
			'First',
			'Alpha',
			'Zulu',
			'Able',
			'Beta',
		])
	})

	test('sorts levels by points then localized name', () => {
		const level = (id: number, name: string, points: number | null): OmniSearchLevelResult => ({
			kind: 'level',
			id,
			xxHash: String(id),
			name,
			authorName: null,
			imageUrl: null,
			points,
			rating: null,
			voteCount: 0,
		})
		const levels = [level(1, 'Zulu', 100), level(2, 'Alpha', 100), level(3, 'Top', 200)]

		expect(sortOmniSearchLevels(levels, 'en').map(({ name }) => name)).toEqual([
			'Top',
			'Alpha',
			'Zulu',
		])
	})

	test('uses request-free NuxtUI presentation and deliberate activation limits', () => {
		expect(OMNI_SEARCH_MINIMUM_LENGTH).toBe(2)
		expect(OMNI_SEARCH_DEBOUNCE_MS).toBe(250)
		expect(component).toContain('<UInputMenu')
		expect(component).toContain('<NuxtImg')
		expect(component).not.toContain('useQuery(')
		expect(component).not.toContain('$fetch(')
		expect(component).toContain('isLevelRatingAvailable(item.rating, item.voteCount)')
	})

	test('uses compact responsive result groups with a taller desktop viewport', () => {
		expect(component).toContain('computed<SearchMenuItem[][]>')
		expect(component).toContain('lg:grid lg:grid-cols-2 lg:items-start')
		expect(component).toContain('lg:max-h-[min(50rem,85vh)]')
		expect(component).toContain('lg:w-[min(64rem,calc(100vw-3rem))]')
		expect(component).toContain('gap-2 px-2.5 py-1.5')
		expect(component).toContain('width="40"')
		expect(component).toContain('height="40"')
	})
})
