import { describe, expect, test } from 'vitest'
import { observeViewportPrefetch } from '../../app/composables/useViewportPrefetch'

describe('viewport prefetch observer', () => {
	test('activates immediately when IntersectionObserver is unavailable', () => {
		let activations = 0
		observeViewportPrefetch({} as Element, () => activations++, {}, undefined)
		expect(activations).toBe(1)
	})

	test('activates once inside the preload margin and disconnects', () => {
		let callback: IntersectionObserverCallback | undefined
		let observed: Element | undefined
		let disconnects = 0
		let activations = 0
		let init: IntersectionObserverInit | undefined
		const target = {} as Element
		const cleanup = observeViewportPrefetch(
			target,
			() => activations++,
			{},
			(nextCallback, nextInit) => {
				callback = nextCallback
				init = nextInit
				return {
					disconnect: () => disconnects++,
					observe: (element) => {
						observed = element
					},
				}
			},
		)

		expect(observed).toBe(target)
		expect(init?.rootMargin).toBe('100% 0px')
		callback?.(
			[{ isIntersecting: false } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		)
		expect(activations).toBe(0)
		callback?.(
			[{ isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		)
		expect(activations).toBe(1)
		expect(disconnects).toBe(1)
		callback?.(
			[{ isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		)
		expect(activations).toBe(1)
		expect(disconnects).toBe(1)
		cleanup()
		expect(disconnects).toBe(2)
	})

	test('supports a custom root margin', () => {
		let rootMargin: string | undefined
		observeViewportPrefetch(
			{} as Element,
			() => {},
			{ rootMargin: '50% 0px' },
			(_callback, init) => {
				rootMargin = init.rootMargin
				return { disconnect: () => {}, observe: () => {} }
			},
		)
		expect(rootMargin).toBe('50% 0px')
	})
})
