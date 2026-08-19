import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLevelFavouriteState } from '../../app/composables/useLevelFavourite'
import { runOptimisticFavouriteToggle } from '../../app/utils/favouriteState'

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('optimistic favourite state', () => {
	it('publishes pending state before committing successful mutation', async () => {
		const states: Array<[boolean, boolean]> = []
		const mutate = vi.fn(async () => undefined)

		await runOptimisticFavouriteToggle(
			false,
			(favourited, pending) => states.push([favourited, pending]),
			mutate,
		)

		expect(states).toEqual([
			[true, true],
			[true, false],
		])
		expect(mutate).toHaveBeenCalledOnce()
	})

	it('rolls back failed mutation and preserves rejection', async () => {
		const states: Array<[boolean, boolean]> = []
		const failure = new Error('mutation failed')

		await expect(
			runOptimisticFavouriteToggle(
				true,
				(favourited, pending) => states.push([favourited, pending]),
				async () => {
					throw failure
				},
			),
		).rejects.toBe(failure)
		expect(states).toEqual([
			[false, true],
			[true, false],
		])
	})

	it('shares optimistic state across duplicate controls and guards pending requests', async () => {
		const states = new Map<string, { value: unknown }>()
		vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
			const existing = states.get(key)
			if (existing) return existing
			const state = { value: initialize() }
			states.set(key, state)
			return state
		})
		vi.stubGlobal('readonly', <T>(value: T) => value)
		let resolveRequest!: () => void
		const request = new Promise<void>((resolve) => {
			resolveRequest = resolve
		})
		const fetch = vi.fn(() => request)
		vi.stubGlobal('$fetch', fetch)
		const target = {
			id: 42,
			xxHash: '0123456789ABCDEF0123456789ABCDEF',
			favourited: false,
			userId: 7,
		}
		const firstControl = useLevelFavouriteState()
		const duplicateControl = useLevelFavouriteState()

		firstControl.initialize(target)
		duplicateControl.initialize(target)
		const mutation = firstControl.toggle(target)

		expect(duplicateControl.isFavourited(target)).toBe(true)
		expect(duplicateControl.isPending(target)).toBe(true)
		await duplicateControl.toggle(target)
		expect(fetch).toHaveBeenCalledOnce()

		resolveRequest()
		await mutation
		expect(duplicateControl.isFavourited(target)).toBe(true)
		expect(duplicateControl.isPending(target)).toBe(false)
		expect(firstControl.revision.value).toBe(1)
	})
})
