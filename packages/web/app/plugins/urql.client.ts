import urql, {
	cacheExchange,
	createClient,
	fetchExchange,
	ssrExchange,
	subscriptionExchange,
} from '@urql/vue'
import type { Client as GraphqlWsClient, SubscribePayload } from 'graphql-ws'

export default defineNuxtPlugin((nuxtApp) => {
	const config = useRuntimeConfig()
	const ssr = ssrExchange({ isClient: true, initialState: nuxtApp.payload.data.urql })
	let wsClientPromise: Promise<GraphqlWsClient> | undefined
	const getWsClient = () => {
		wsClientPromise ??= import('graphql-ws').then(({ createClient: createWsClient }) =>
			createWsClient({ url: config.public.graphqlWsUrl }),
		)
		return wsClientPromise
	}
	const client = createClient({
		url: config.public.graphqlHttpUrl,
		preferGetMethod: false,
		fetchOptions: { credentials: 'include' },
		exchanges: [
			cacheExchange,
			ssr,
			subscriptionExchange({
				forwardSubscription(request) {
					return {
						subscribe(sink) {
							let cancelled = false
							let unsubscribe: (() => void) | undefined
							void getWsClient()
								.then((wsClient) => {
									if (cancelled) return
									unsubscribe = wsClient.subscribe(
										request as SubscribePayload,
										sink,
									)
									if (cancelled) unsubscribe()
								})
								.catch((error: unknown) => {
									if (!cancelled) sink.error?.(error)
								})
							return {
								unsubscribe() {
									cancelled = true
									unsubscribe?.()
								},
							}
						},
					}
				},
			}),
			fetchExchange,
		],
	})
	nuxtApp.vueApp.use(urql, client)
})
