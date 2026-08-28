import { Elysia } from 'elysia'
import { config } from './config'
import {
	authRoutes,
	discordBotRoutes,
	favouriteRoutes,
	jobRoutes,
	levelRoutes,
	lobbyRoutes,
	recordRoutes,
	userRoutes,
	voteRoutes,
} from './modules'
import { OPENAPI_TAG } from './openapi'
import { withContext } from './plugins/withContext'
import { withCors } from './plugins/withCors'
import { withDocumentation } from './plugins/withDocumentation'
import { withErrors } from './plugins/withErrors'
import { withLogging } from './plugins/withLogging'
import { withSpanEnrichment } from './plugins/withSpanEnrichment'
import { createWithTelemetry } from './plugins/withTelemetry'

export function buildServer() {
	return new Elysia({
		precompile: true,
		serve: {
			development: config.nodeEnv !== 'production',
		},
	})
		.use(withLogging)
		.use(withCors)
		.use(createWithTelemetry())
		.use(withSpanEnrichment)
		.use(withDocumentation)
		.use(withErrors)
		.use(withContext)
		.use(authRoutes)
		.use(discordBotRoutes)
		.use(favouriteRoutes)
		.use(userRoutes)
		.use(levelRoutes)
		.use(lobbyRoutes)
		.use(recordRoutes)
		.use(voteRoutes)
		.use(jobRoutes)
		.get('/favicon.ico', { detail: { hide: true } }, ({ set }) => {
			set.status = 204
			return
		})
		.get(
			'/healthz',
			{
				detail: {
					operationId: 'getHealth',
					summary: 'Check API health',
					description:
						'Returns a lightweight readiness response when the API process is available.',
					tags: [OPENAPI_TAG.system],
				},
			},
			() => ({ status: 'ok' }),
		)
		.head(
			'/healthz',
			{
				detail: {
					operationId: 'headHealth',
					summary: 'Check API health (HEAD)',
					description:
						'Returns a lightweight readiness response when the API process is available.',
					tags: [OPENAPI_TAG.system],
				},
			},
			() => ({ status: 'ok' }),
		)
}
