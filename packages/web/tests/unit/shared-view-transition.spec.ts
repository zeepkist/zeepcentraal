import { describe, expect, it } from 'vitest'
import {
	createSharedViewTransitionSourceKey,
	isSharedViewTransitionActivation,
	matchesSharedViewTransitionTarget,
	resolveSharedViewTransitionDirection,
	type SharedViewTransitionSelection,
} from '../../app/utils/sharedViewTransition'

const selection: SharedViewTransitionSelection = {
	entity: 'level',
	entityId: 'abc',
	sourceKey: '/levels:levels-explorer:level:abc',
	sourceRoute: '/levels',
	targetRoute: '/level/abc',
	preview: { title: 'Test level', mediaUrl: '/test.webp' },
}

function click(overrides: Partial<MouseEvent> = {}) {
	return {
		altKey: false,
		button: 0,
		ctrlKey: false,
		defaultPrevented: false,
		metaKey: false,
		shiftKey: false,
		...overrides,
	} as MouseEvent
}

describe('shared view transition coordinator', () => {
	it('activates primary unmodified clicks and keyboard-generated clicks', () => {
		expect(isSharedViewTransitionActivation(click())).toBe(true)
		expect(isSharedViewTransitionActivation(click({ detail: 0 }))).toBe(true)
	})

	it.each([
		{ button: 1 },
		{ altKey: true },
		{ ctrlKey: true },
		{ metaKey: true },
		{ shiftKey: true },
		{ defaultPrevented: true },
	])('rejects modified or intercepted activation: %o', (override) => {
		expect(isSharedViewTransitionActivation(click(override))).toBe(false)
	})

	it('builds stable placement-aware source keys', () => {
		expect(
			createSharedViewTransitionSourceKey('/levels', 'dashboard-hot', 'level', 'abc'),
		).toBe('/levels:dashboard-hot:level:abc')
		expect(
			createSharedViewTransitionSourceKey('/levels', 'dashboard-hot', 'level', 'abc'),
		).toBe(createSharedViewTransitionSourceKey('/levels', 'dashboard-hot', 'level', 'abc'))
		expect(
			createSharedViewTransitionSourceKey('/levels', 'dashboard-popular', 'level', 'abc'),
		).not.toBe(selection.sourceKey)
	})

	it('classifies exact forward and browser-back pairs only', () => {
		expect(resolveSharedViewTransitionDirection(selection, '/levels', '/level/abc')).toBe(
			'detail-forward',
		)
		expect(resolveSharedViewTransitionDirection(selection, '/level/abc', '/levels')).toBe(
			'detail-back',
		)
		expect(resolveSharedViewTransitionDirection(selection, '/level/abc', '/mods')).toBeNull()
		expect(resolveSharedViewTransitionDirection(null, '/levels', '/level/abc')).toBeNull()
	})

	it('matches preview only for exact entity, id, and destination route', () => {
		expect(matchesSharedViewTransitionTarget(selection, '/level/abc', 'level', 'abc')).toBe(
			true,
		)
		expect(matchesSharedViewTransitionTarget(selection, '/level/other', 'level', 'abc')).toBe(
			false,
		)
		expect(matchesSharedViewTransitionTarget(selection, '/level/abc', 'mod', 'abc')).toBe(false)
		expect(matchesSharedViewTransitionTarget(selection, '/level/abc', 'level', 'other')).toBe(
			false,
		)
		expect(matchesSharedViewTransitionTarget(null, '/level/abc', 'level', 'abc')).toBe(false)
	})
})
