import { openapi } from '@elysiajs/openapi'
import { COOKIES } from '@zeepkist/core'
import { Elysia } from 'elysia'

export const withDocumentation = new Elysia().use(
	openapi({
		embedSpec: true, // Bun 1.4 compatibility
		documentation: {
			info: {
				title: 'ZeepCentraal API V3',
				version: '0.1.0',
				description:
					'Authentication and gameplay ingestion API used by GTR, ZeepCentraal web sessions, and trusted background services.',
			},
			tags: [
				{
					name: 'auth',
					description: 'GTR authentication, browser OAuth sign-in, and token refresh.',
				},
				{ name: 'user', description: 'Authenticated ZeepCentraal account updates.' },
				{ name: 'level', description: 'Level discovery and Workshop metadata requests.' },
				{ name: 'record', description: 'Authenticated GTR record submission.' },
				{ name: 'vote', description: 'Authenticated level rating submission.' },
				{ name: 'job', description: 'Internal background-job triggers.' },
				{ name: 'system', description: 'Service health and operational endpoints.' },
			],
			components: {
				securitySchemes: {
					gtrBearerAuth: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT',
						description:
							'GTR access token returned by `/auth/login` or `/auth/refresh`.',
					},
					accessToken: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT',
						description: 'Steam, Discord, or GTR access token.',
					},
					webSession: {
						type: 'apiKey',
						in: 'cookie',
						name: COOKIES.AccessToken,
						description: 'HttpOnly ZeepCentraal browser access-token cookie.',
					},
					jobBearerAuth: {
						type: 'http',
						scheme: 'bearer',
						description: 'Private service token for trusted job producers.',
					},
				},
			},
		},
	}),
)
