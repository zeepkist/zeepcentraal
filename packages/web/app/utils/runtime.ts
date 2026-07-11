const productionGraphqlHttpUrl = 'https://graphql.zeepki.st'
const productionGraphqlWsUrl = 'wss://graphql.zeepki.st'
const productionBackendUrl = 'https://backend.zeepki.st'

export type WebRuntimeDefaults = {
	graphqlHttpUrl: string
	graphqlWsUrl: string
	backendUrl: string
}

export function resolveWebRuntimeDefaults(
	env: Record<string, string | undefined>,
): WebRuntimeDefaults {
	return {
		graphqlHttpUrl: env.NUXT_PUBLIC_GRAPHQL_HTTP_URL ?? productionGraphqlHttpUrl,
		graphqlWsUrl: env.NUXT_PUBLIC_GRAPHQL_WS_URL ?? productionGraphqlWsUrl,
		backendUrl: env.NUXT_PUBLIC_BACKEND_URL ?? productionBackendUrl,
	}
}

export const webRuntimeDefaults = resolveWebRuntimeDefaults(process.env)
