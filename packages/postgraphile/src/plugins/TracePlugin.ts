import { SpanStatusCode } from '@opentelemetry/api'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { getTracer } from '../telemetry'
import type { GraphileField, GraphilePlugin } from '../types'

export const TracePlugin: GraphilePlugin = (builder) => {
	if (!postgraphileConfig.fieldTracing) {
		return
	}

	builder.hook<GraphileField>('GraphQLObjectType:fields:field', (field, _build, context) => {
		const fieldName = context.scope.fieldName ?? field.name ?? 'unknown'
		const originalResolve =
			field.resolve ?? ((parent: Record<string, unknown>) => parent[fieldName])
		const tracer = getTracer()

		return {
			...field,
			async resolve(parent, args, resolverContext, info) {
				return tracer.startActiveSpan(fieldName, async (span) => {
					try {
						const argKeys = Object.keys(args)
						if (argKeys.length) {
							for (const key of argKeys) {
								span.setAttribute(
									`graphql.arguments.${key}`,
									JSON.stringify(args[key]),
								)
							}
							span.setAttribute('graphql.arguments', JSON.stringify(args))
						}

						return await originalResolve(parent, args, resolverContext, info)
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error)
						span.recordException(error instanceof Error ? error : new Error(message))
						span.addEvent('error', {
							'error.message': message,
							'graphql.field.name': fieldName,
						})
						span.setStatus({
							code: SpanStatusCode.ERROR,
							message,
						})
						throw error
					} finally {
						span.end()
					}
				})
			},
		}
	})
}
