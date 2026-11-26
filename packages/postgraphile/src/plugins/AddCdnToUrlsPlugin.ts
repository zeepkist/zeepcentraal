import { URL } from 'node:url'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { setActiveSpanAttributes } from '@zeepkist/telemetry'
import { wrapPlans } from 'postgraphile/utils'

const FIELDS = new Set(['ghostUrl', 'imageUrl'])

function getCdnBaseUrl() {
	if (!postgraphileConfig.cdnBaseUrl) {
		return undefined
	}

	try {
		return new URL(postgraphileConfig.cdnBaseUrl)
	} catch {
		console.warn('Invalid PostGraphile CDN base URL')
		return undefined
	}
}

const CDN_BASE_URL = getCdnBaseUrl()

function toCdnUrl(value: unknown) {
	if (typeof value !== 'string' || !CDN_BASE_URL) return value

	try {
		return new URL(value, CDN_BASE_URL).toString()
	} catch {
		setActiveSpanAttributes({ 'graphql.cdn.invalid_url': true })
		return value
	}
}

export const AddCdnToUrlsPlugin = wrapPlans(
	(context, build) => {
		const { fieldName } = context.scope

		return fieldName && FIELDS.has(fieldName)
			? {
					lambda: build.grafast.lambda,
				}
			: null
	},
	({ lambda }) =>
		(plan, $source, fieldArgs, info) => {
			const $value = plan($source, fieldArgs, info)
			return lambda($value, (value: unknown) => toCdnUrl(value))
		},
	{
		name: 'AddCdnToUrlsPlugin',
		version: '1.0.0',
		disableResolverEmulationWarnings: true,
	},
)
