import urql, { cacheExchange, createClient, fetchExchange, ssrExchange } from '@urql/vue'
import { tracedFetch } from '@zeepkist/telemetry'

export default defineNuxtPlugin((nuxtApp) => {
	const config = useRuntimeConfig()
	const requestHeaders = useRequestHeaders(['cookie'])
	const ssr = ssrExchange({ isClient: false })
	nuxtApp.hook('app:rendered', () => {
		nuxtApp.payload.data.urql = ssr.extractData()
	})
	const client = createClient({
		url: config.public.graphqlHttpUrl,
		preferGetMethod: false,
		fetch: ((input, init) =>
			tracedFetch(input, init, { operationName: 'web.graphql.ssr' })) as typeof fetch,
		fetchOptions: () => ({ credentials: 'include', headers: requestHeaders }),
		exchanges: [cacheExchange, ssr, fetchExchange],
	})
	nuxtApp.vueApp.use(urql, client)
})
