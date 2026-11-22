import cors from '@elysia/cors'
import { Elysia } from 'elysia'

export function createPostGraphileCors(credentialOrigins: readonly string[]) {
	const trustedOrigins = new Set(credentialOrigins)
	return new Elysia({ name: '@zeepkist/postgraphile/cors' })
		.onRequest(({ request, set }) => {
			const origin = request.headers.get('origin')
			if (origin && trustedOrigins.has(origin)) {
				set.headers['access-control-allow-credentials'] = 'true'
			}
		})
		.use(cors({ credentials: false }))
		.as('global')
}
