import { setActiveSpanAttributes } from '@zeepkist/telemetry'
import type { Middleware } from 'koa'

const HEADERS_TO_COLLECT = [
	'X-Zeepkist-Version',
	'X-Zeepkist-Major-Version',
	'X-GTR-Version',
	'X-Steam-ID',
]

export const collectHeaderMetrics: Middleware = async (ctx, next) => {
	const attributes: Record<string, string> = {}

	for (const header of HEADERS_TO_COLLECT) {
		const value = ctx.headers[header.toLowerCase()]

		if (typeof value === 'string') {
			attributes[`graphql.header.${header}`] = value
		}
	}

	setActiveSpanAttributes(attributes)

	await next()
}
