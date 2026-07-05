import { URL } from 'node:url'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { recordSpanWarning } from '../telemetry'
import type { GraphileField, GraphilePlugin } from '../types'

const FIELDS = new Set(['ghostUrl', 'imageUrl'])
let isCdnBaseUrlInvalid = false

function getCdnBaseUrl() {
	if (!postgraphileConfig.cdnBaseUrl) {
		return undefined
	}

	try {
		return new URL(postgraphileConfig.cdnBaseUrl)
	} catch {
		isCdnBaseUrlInvalid = true
		return undefined
	}
}

const CDN_BASE_URL = getCdnBaseUrl()

export const AddCdnToUrlsPlugin: GraphilePlugin = (builder) => {
	builder.hook<GraphileField>('GraphQLObjectType:fields:field', (field, _build, context) => {
		const { fieldName } = context.scope

		if (!fieldName || !FIELDS.has(fieldName)) {
			return field
		}

		const resolve = field.resolve ?? ((parent: Record<string, unknown>) => parent[fieldName])

		return {
			...field,
			resolve: async (parent, args, resolverContext, info) => {
				const originalValue = await resolve(parent, args, resolverContext, info)

				if (typeof originalValue !== 'string' || !CDN_BASE_URL) {
					if (originalValue && isCdnBaseUrlInvalid) {
						recordSpanWarning('CDN URL base invalid', {
							'graphql.field.name': fieldName,
						})
					}

					return originalValue
				}

				try {
					return new URL(originalValue, CDN_BASE_URL).toString()
				} catch (error) {
					recordSpanWarning('CDN URL conversion failed', {
						'graphql.field.name': fieldName,
						'graphql.cdn.error': error instanceof Error ? error.message : String(error),
					})
					return originalValue
				}
			},
		}
	})
}
