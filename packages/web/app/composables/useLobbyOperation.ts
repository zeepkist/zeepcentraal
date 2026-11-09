import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { useQuery, useSubscription } from '@urql/vue'
import { type Ref, watch } from 'vue'

/** SSR seed plus visible-page subscription. No timed network requests. */
export function useLobbyOperation<TData, TVariables extends Record<string, unknown>>(
	query: TypedDocumentNode<TData, TVariables>,
	subscription: TypedDocumentNode<{ query: TData }, TVariables>,
	variables: Ref<TVariables>,
) {
	const mounted = shallowRef(false)
	const transport = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>(
		'graphql-ws-status',
		() => 'idle',
	)
	const pageVisible = usePageVisibility()
	const key = computed(() => JSON.stringify(variables.value))
	const result = useQuery({ query, variables, requestPolicy: 'cache-and-network' })
	const live = useSubscription<
		{ query: TData },
		{ key: string; data: TData } | undefined,
		TVariables
	>(
		{
			query: subscription,
			variables,
			pause: computed(() => import.meta.server || !mounted.value || !pageVisible.value),
		},
		(previous: { key: string; data: TData } | undefined, data) =>
			data.query == null ? previous : { key: key.value, data: data.query },
	)
	const seedSnapshot = shallowRef<{ key: string; data: TData }>()
	const liveSnapshot = shallowRef<{ key: string; data: TData }>()
	watch(
		[result.data, result.error, result.operation],
		([data, error, operation]) => {
			if (data != null && !error)
				seedSnapshot.value = { key: JSON.stringify(operation?.variables), data }
		},
		{ immediate: true },
	)
	watch(
		[live.data, live.error],
		([packet, error]) => {
			if (packet && !error) liveSnapshot.value = packet
		},
		{ immediate: true },
	)
	const data = computed(() => {
		if (liveSnapshot.value?.key === key.value) return liveSnapshot.value.data
		if (seedSnapshot.value?.key === key.value) return seedSnapshot.value.data
		if (!result.error.value && JSON.stringify(result.operation.value?.variables) === key.value)
			return result.data.value
		return undefined
	})
	const error = computed(() => live.error.value ?? result.error.value)
	const connecting = computed(
		() =>
			mounted.value &&
			pageVisible.value &&
			(transport.value !== 'connected' || live.data.value?.key !== key.value),
	)
	onMounted(() => {
		mounted.value = true
	})
	onServerPrefetch(async () => {
		await result
	})
	return { data, error, connecting, fetching: result.fetching, result, live }
}
