import { Elysia } from 'elysia'
import { authRoutes, jobRoutes, recordRoutes, userRoutes, voteRoutes } from './modules'
import { withContext } from './plugins/withContext'
import { withCors } from './plugins/withCors'
import { withDocumentation } from './plugins/withDocumentation'
import { withErrors } from './plugins/withErrors'
import { withLogging } from './plugins/withLogging'
import { withSpanEnrichment } from './plugins/withSpanEnrichment'
import { withTelemetry } from './plugins/withTelemetry'

export function buildServer() {
	return new Elysia()
		.use(withLogging)
		.use(withCors)
		.use(withTelemetry)
		.use(withSpanEnrichment)
		.use(withDocumentation)
		.use(withErrors)
		.use(withContext)
		.use(authRoutes)
		.use(userRoutes)
		.use(recordRoutes)
		.use(voteRoutes)
		.use(jobRoutes)
		.get('/favicon.ico', ({ set }) => {
			set.status = 204
			return
		})
		.get('/healthz', () => ({ status: 'ok' }))
}
