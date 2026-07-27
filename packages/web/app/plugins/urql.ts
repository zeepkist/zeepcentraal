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
	const requestHeaders = useRequestHeaders(['cookie'])
	const ssr = ssrExchange({
		isClient: import.meta.client,
		initialState: import.meta.client ? nuxtApp.payload.data.urql : undefined,
	})

	if (import.meta.server) {
		nuxtApp.hook('app:rendered', () => {
			nuxtApp.payload.data.urql = ssr.extractData()
		})
	}

	const exchanges = [cacheExchange, ssr, fetchExchange]

	if (import.meta.client) {
		let wsClientPromise: Promise<GraphqlWsClient> | undefined
		const getWsClient = () => {
			wsClientPromise ??= import('graphql-ws').then(({ createClient: createWsClient }) =>
				createWsClient({ url: config.public.graphqlWsUrl }),
			)
			return wsClientPromise
		}

		exchanges.splice(
			2,
			0,
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
		)
	}

	const client = createClient({
		url: config.public.graphqlHttpUrl,
		exchanges,
		preferGetMethod: false,
		fetchOptions: () => ({
			credentials: 'include',
			headers: import.meta.server ? requestHeaders : undefined,
		}),
	})

	nuxtApp.vueApp.use(urql, client)
})
