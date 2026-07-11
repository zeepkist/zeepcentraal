import urql, {
	cacheExchange,
	createClient,
	fetchExchange,
	ssrExchange,
	subscriptionExchange,
} from '@urql/vue'
import { createClient as createWsClient } from 'graphql-ws'

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
		const wsClient = createWsClient({
			url: config.public.graphqlWsUrl,
		})

		exchanges.splice(
			2,
			0,
			subscriptionExchange({
				forwardSubscription(request) {
					return {
						subscribe(sink) {
							const unsubscribe = wsClient.subscribe(
								request as Parameters<typeof wsClient.subscribe>[0],
								sink,
							)
							return { unsubscribe }
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
