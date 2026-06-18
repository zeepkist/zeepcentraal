import cors from '@elysiajs/cors'
import { config } from '@zeepkist/core'
import { Elysia } from 'elysia'

export const withCors = new Elysia().use(
	cors({
		origin: ({ headers }) => {
			const origin = headers.get('origin')
			return !origin || config.http.corsAllowedOrigins.includes(origin)
		},
		credentials: true,
	}),
)
