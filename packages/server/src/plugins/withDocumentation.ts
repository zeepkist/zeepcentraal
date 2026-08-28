import { toOpenAPISchema } from '@elysia/openapi/openapi'
import { ScalarRender } from '@elysia/openapi/scalar'
import { COOKIES } from '@zeepkist/core'
import type { Elysia } from 'elysia'
import { PROBLEM_DETAILS_SCHEMA } from '../openapi'

// Beta.1 main entry imports an unpublished generator dependency; official subpaths remain valid.

const documentation = {
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
		{ name: 'lobby', description: 'Public live Zeepkist lobby status.' },
		{ name: 'record', description: 'Authenticated GTR record submission.' },
		{ name: 'vote', description: 'Authenticated level rating submission.' },
		{ name: 'favourite', description: 'Authenticated favourite level mutations.' },
		{ name: 'job', description: 'Internal background-job triggers.' },
		{
			name: 'discord-bot',
			description: 'Private Discord bot state and account-link operations.',
		},
		{ name: 'system', description: 'Service health and operational endpoints.' },
	],
	components: {
		schemas: {
			ProblemDetails: PROBLEM_DETAILS_SCHEMA,
		},
		securitySchemes: {
			gtrBearerAuth: {
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				description: 'GTR access token returned by `/auth/login` or `/auth/refresh`.',
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
			webRefreshSession: {
				type: 'apiKey',
				in: 'cookie',
				name: COOKIES.RefreshToken,
				description: 'HttpOnly ZeepCentraal browser refresh-token cookie.',
			},
			jobBearerAuth: {
				type: 'http',
				scheme: 'bearer',
				description: 'Private service token for trusted job producers.',
			},
			discordBotBearerAuth: {
				type: 'http',
				scheme: 'bearer',
				description: 'Private service token for ZeepCentraal Discord bot.',
			},
		},
	},
}

function fullSchema(host: Elysia) {
	const generated = toOpenAPISchema(host)

	return {
		openapi: '3.0.3',
		...documentation,
		paths: generated.paths,
		components: {
			...documentation.components,
			schemas: {
				...generated.components.schemas,
				...documentation.components.schemas,
			},
		},
	}
}

export const withDocumentation = (host: Elysia) => {
	let routeCount = 0
	let schema: ReturnType<typeof fullSchema> | undefined
	const getSchema = () => {
		if (schema && routeCount === host.routes.length) return schema
		routeCount = host.routes.length
		schema = fullSchema(host)
		return schema
	}
	const page = () =>
		new Response(
			ScalarRender(
				documentation.info,
				{
					url: 'openapi/json',
					version: 'latest',
					cdn: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js',
					_integration: 'elysiajs',
				},
				JSON.stringify(getSchema()),
			),
			{ headers: { 'content-type': 'text/html; charset=utf8' } },
		)

	return host
		.get('/openapi', { detail: { hide: true } }, page)
		.get('/openapi/json', { detail: { hide: true } }, getSchema)
}
