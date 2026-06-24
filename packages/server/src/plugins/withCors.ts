import cors from '@elysiajs/cors'
import { serverConfig } from '@zeepkist/core/config/server'
import { Elysia } from 'elysia'

export const withCors = new Elysia().use(
	cors({
		origin: ({ headers }) => {
			const origin = headers.get('origin')
			return !origin || serverConfig.http.corsAllowedOrigins.includes(origin)
		},
		credentials: true,
	}),
)
