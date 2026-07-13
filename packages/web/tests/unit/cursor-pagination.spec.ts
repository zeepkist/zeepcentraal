import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	type CursorKeys,
	canNavigateNext,
	canNavigatePrevious,
	getCursorVariables,
	isFirstCursorPage,
	isInitialPagePending,
	replaceCursorQuery,
} from '../../app/composables/useCursorPagination'

const keys: CursorKeys = { after: 'after', before: 'before', last: 'last' }

describe('cursor pagination', () => {
	it('builds first, forward, backward, and last-page variables', () => {
		expect(getCursorVariables(25)).toEqual({ first: 25 })
		expect(getCursorVariables(25, 'end')).toEqual({ first: 25, after: 'end' })
		expect(getCursorVariables(25, undefined, 'start')).toEqual({
			last: 25,
			before: 'start',
		})
		expect(getCursorVariables(25, 'stale', 'stale', true)).toEqual({ last: 25 })
	})

	it('identifies only cursor-free non-tail state as first page', () => {
		expect(isFirstCursorPage()).toBe(true)
		expect(isFirstCursorPage('after')).toBe(false)
		expect(isFirstCursorPage(undefined, 'before')).toBe(false)
		expect(isFirstCursorPage(undefined, undefined, true)).toBe(false)
	})

	it('shows initial loading only when no retained page content exists', () => {
		expect(isInitialPagePending(true, 0)).toBe(true)
		expect(isInitialPagePending(true, 25)).toBe(false)
		expect(isInitialPagePending(false, 0)).toBe(false)
		expect(isInitialPagePending(false, 25, false)).toBe(true)
	})

	it('replaces direction state atomically for reversible navigation', () => {
		const forward = replaceCursorQuery({ q: 'search', before: 'old', last: '1' }, keys, {
			after: 'end',
		})
		expect(forward).toEqual({ q: 'search', after: 'end' })

		const backward = replaceCursorQuery(forward, keys, { before: 'start' })
		expect(backward).toEqual({ q: 'search', before: 'start' })

		const forwardAgain = replaceCursorQuery(backward, keys, { after: 'next-end' })
		expect(forwardAgain).toEqual({ q: 'search', after: 'next-end' })
	})

	it('clears state for first and sets marker for last', () => {
		const current = { sort: 'points', after: 'end' }
		expect(replaceCursorQuery(current, keys)).toEqual({ sort: 'points' })
		expect(replaceCursorQuery(current, keys, { last: '1' })).toEqual({
			sort: 'points',
			last: '1',
		})
	})

	it('preserves filters and other pagination namespaces', () => {
		expect(
			replaceCursorQuery(
				{
					q: 'player',
					wrAfter: 'wr-end',
					pbAfter: 'pb-end',
					recentBefore: 'recent-start',
				},
				{ after: 'wrAfter', before: 'wrBefore', last: 'wrLast' },
				{ wrBefore: 'wr-start' },
			),
		).toEqual({
			q: 'player',
			wrBefore: 'wr-start',
			pbAfter: 'pb-end',
			recentBefore: 'recent-start',
		})
	})

	it('derives navigation availability from cursor mode and reliable PageInfo direction', () => {
		const forwardPage = {
			startCursor: 'page-start',
			endCursor: 'page-end',
			hasPreviousPage: false,
			hasNextPage: true,
		}
		expect(canNavigatePrevious('forward', 'after-cursor', forwardPage)).toBe(true)
		expect(canNavigatePrevious('forward', undefined, forwardPage)).toBe(false)
		expect(canNavigateNext('forward', undefined, forwardPage)).toBe(true)

		const backwardPage = { ...forwardPage, hasPreviousPage: true, hasNextPage: false }
		expect(canNavigatePrevious('backward', undefined, backwardPage)).toBe(true)
		expect(canNavigateNext('backward', 'before-cursor', backwardPage)).toBe(true)
		expect(canNavigateNext('last', undefined, backwardPage)).toBe(false)
	})

	it('renders and emits all four controls with boundary guards', () => {
		const component = readFileSync(
			new URL('../../app/components/common/CursorPagination.vue', import.meta.url),
			'utf8',
		)
		expect(component.match(/<UButton/g)).toHaveLength(4)
		expect(component).toContain('@click="$emit(\'first\')"')
		expect(component).toContain('@click="$emit(\'previous\')"')
		expect(component).toContain('@click="$emit(\'next\')"')
		expect(component).toContain('@click="$emit(\'last\')"')
		expect(component.match(/!canGoPrevious \|\| pending/g)).toHaveLength(2)
		expect(component.match(/!canGoNext \|\| pending/g)).toHaveLength(2)
		expect(component).toContain('name="chevrons-left"')
		expect(component).toContain('name="chevrons-right"')
		expect(component).toContain('name="loader-2"')
		expect(component).toContain('motion-safe:animate-spin')
		expect(component).toContain('role="status"')
		expect(component).toContain(':aria-label="loadingLabel"')
	})
	it('retains content across every paginated query refresh', () => {
		const pages = [
			'../../app/pages/levels.vue',
			'../../app/pages/users.vue',
			'../../app/pages/records/me.vue',
			'../../app/pages/super-league/index.vue',
			'../../app/pages/super-league/[seasonSlug]/index.vue',
			'../../app/pages/super-league/[seasonSlug]/[roundSlug]/index.vue',
			'../../app/pages/super-league/[seasonSlug]/[roundSlug]/[levelSlug].vue',
			'../../app/pages/level/[xxh128].vue',
		]
		for (const page of pages) {
			expect(readFileSync(new URL(page, import.meta.url), 'utf8')).toContain(
				'isInitialPending(',
			)
		}
		const wrapper = readFileSync(
			new URL('../../app/components/user/UserResultsSection.vue', import.meta.url),
			'utf8',
		)
		expect(wrapper).toContain('pending && records.length === 0')
		const userPage = readFileSync(
			new URL('../../app/pages/user/[steamid].vue', import.meta.url),
			'utf8',
		)
		expect(userPage).toContain('<UserResultsSection')
	})
})
