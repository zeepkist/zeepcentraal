import urql, { cacheExchange, createClient, fetchExchange, ssrExchange } from '@urql/vue'
import { tracedFetch } from '@zeepkist/telemetry'
import { isWebErrorResponse, shouldRecordWebError } from '../../runtime/telemetryPolicy'
import { useAuthRequestCookies } from '../composables/useAuthRequestCookies'

export default defineNuxtPlugin((nuxtApp) => {
	const config = useRuntimeConfig()
	const cookies = useAuthRequestCookies()
	const ssr = ssrExchange({ isClient: false })
	nuxtApp.hook('app:rendered', () => {
		nuxtApp.payload.data.urql = ssr.extractData()
	})
	const client = createClient({
		url: config.public.graphqlHttpUrl,
		preferGetMethod: false,
		fetch: ((input, init) =>
			tracedFetch(input, init, {
				operationName: 'web.graphql.ssr',
				shouldRecordError: shouldRecordWebError,
				isErrorResponse: isWebErrorResponse,
			})) as typeof fetch,
		fetchOptions: () => ({ credentials: 'include', headers: cookies.headers() }),
		exchanges: [cacheExchange, ssr, fetchExchange],
	})
	nuxtApp.vueApp.use(urql, client)
})
