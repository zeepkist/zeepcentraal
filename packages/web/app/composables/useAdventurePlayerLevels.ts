import { useClientHandle } from '@urql/vue'
import {
	type Zc_AdventurePlayerLevelFragment,
	Zc_AdventurePlayerLevelsDocument,
	Zc_AdventurePlayerLevelsLiveDocument,
} from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import { mapAdventurePlayerLevels } from '~/utils/adventurePlayerLevels'

export function useAdventurePlayerLevels(series: Ref<string | undefined>, playerId: Ref<number>) {
	const { client } = useClientHandle()
	const pageVisible = usePageVisibility()
	const mounted = shallowRef(false)
	const memberships = shallowRef<Zc_AdventurePlayerLevelFragment[]>([])
	const pending = shallowRef(true)
	const error = shallowRef<string>()
	let generation = 0
	let subscriptions: Array<{ unsubscribe(): void }> = []
	const levels = computed(() => mapAdventurePlayerLevels(memberships.value))
	function stop() {
		for (const subscription of subscriptions) subscription.unsubscribe()
		subscriptions = []
	}
	async function refresh() {
		const current = ++generation
		stop()
		if (!mounted.value || !pageVisible.value) return
		pending.value = true
		error.value = undefined
		const pages = new Map<string | undefined, Zc_AdventurePlayerLevelFragment[]>()
		const variables = (after?: string) => ({
			after,
			playerId: playerId.value,
			includePlayer: true,
			filter: series.value ? { series: { equalTo: series.value } } : undefined,
		})
		try {
			let after: string | undefined
			do {
				const result = await client
					.query(Zc_AdventurePlayerLevelsDocument, variables(after), {
						requestPolicy: 'network-only',
					})
					.toPromise()
				if (current !== generation) return
				const page = result.data?.adventureLevelMemberships
				if (result.error || !page)
					throw new Error(result.error?.message ?? 'Adventure levels unavailable')
				pages.set(after, page.nodes)
				if (!page.pageInfo.hasNextPage) break
				const next = String(page.pageInfo.endCursor ?? '')
				if (!next || pages.has(next)) throw new Error('Invalid Adventure level cursor')
				after = next
			} while (after)
			memberships.value = [...pages.values()].flat()
			pending.value = false
			for (const [cursor, nodes] of pages) {
				const identity = (values: Zc_AdventurePlayerLevelFragment[]) =>
					values.map((value) => `${value.series}:${value.levelId}`).join(',')
				subscriptions.push(
					client
						.subscription(Zc_AdventurePlayerLevelsLiveDocument, variables(cursor))
						.subscribe((result) => {
							if (current !== generation) return
							const page = result.data?.adventureLevelMemberships
							if (result.error) {
								error.value = result.error.message
								return
							}
							if (!page) return
							const expectedNextPage =
								[...pages.keys()].indexOf(cursor) < pages.size - 1
							if (
								identity(page.nodes) !== identity(nodes) ||
								page.pageInfo.hasNextPage !== expectedNextPage
							) {
								void refresh()
								return
							}
							pages.set(cursor, page.nodes)
							memberships.value = [...pages.values()].flat()
						}),
				)
			}
		} catch (cause) {
			if (current === generation)
				error.value = cause instanceof Error ? cause.message : String(cause)
		} finally {
			if (current === generation) pending.value = false
		}
	}
	watch([series, playerId, pageVisible, mounted], () => {
		void refresh()
	})
	onMounted(() => {
		mounted.value = true
	})
	onBeforeUnmount(() => {
		generation++
		stop()
	})
	return { levels, pending, error, refresh }
}
