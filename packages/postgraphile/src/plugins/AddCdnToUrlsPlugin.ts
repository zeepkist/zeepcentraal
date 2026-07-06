import { URL } from 'node:url'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { recordSpanWarning } from '@zeepkist/telemetry'
import { wrapPlans } from 'postgraphile/utils'

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

function toCdnUrl(value: unknown, fieldName: string) {
	if (typeof value !== 'string' || !CDN_BASE_URL) {
		if (value && isCdnBaseUrlInvalid) {
			recordSpanWarning('CDN URL base invalid', {
				'graphql.field.name': fieldName,
			})
		}

		return value
	}

	try {
		return new URL(value, CDN_BASE_URL).toString()
	} catch (error) {
		recordSpanWarning('CDN URL conversion failed', {
			'graphql.field.name': fieldName,
			'graphql.cdn.error': error instanceof Error ? error.message : String(error),
		})
		return value
	}
}

export const AddCdnToUrlsPlugin = wrapPlans(
	(context, build) => {
		const { fieldName } = context.scope

		return fieldName && FIELDS.has(fieldName)
			? {
					fieldName,
					lambda: build.grafast.lambda,
				}
			: null
	},
	({ fieldName, lambda }) =>
		(plan, $source, fieldArgs, info) => {
			const $value = plan($source, fieldArgs, info)
			return lambda($value, (value: unknown) => toCdnUrl(value, fieldName))
		},
	{
		name: 'AddCdnToUrlsPlugin',
		version: '1.0.0',
		disableResolverEmulationWarnings: true,
	},
)
