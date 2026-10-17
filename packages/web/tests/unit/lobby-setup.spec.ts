import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useLobbyFeed } from '../../app/composables/useLobbyFeed'

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('async lobby setup', () => {
	it('registers lifecycle hooks before fetching and retains the SSR snapshot', async () => {
		const snapshot = {
			status: 'live',
			stats: { onlinePlayers: 0, lobbyCount: 0, playersInLobbies: 0 },
			lobbies: [],
			updatedAt: '2026-10-17T00:00:00Z',
			staleSince: null,
		}
		vi.stubGlobal('useRuntimeConfig', () => ({
			public: { backendUrl: 'https://backend.example.test' },
		}))
		vi.stubGlobal('useFetch', () => {
			const state = {
				data: ref<unknown>(null),
				pending: ref(true),
				error: ref(null),
				refresh: vi.fn(),
			}
			return Object.assign(
				Promise.resolve().then(() => {
					state.data.value = snapshot
					state.pending.value = false
					return state
				}),
				state,
			)
		})
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const app = createSSRApp({
			async setup() {
				const feed = await useLobbyFeed()
				return () => h('p', feed.snapshot.value?.status)
			},
		})
		expect(await renderToString(app)).toBe('<p>live</p>')
		expect(
			warn.mock.calls
				.map((call) => String(call[0]))
				.filter((warning) =>
					/no active component instance|no active effect scope/i.test(warning),
				),
		).toEqual([])
	})
})
