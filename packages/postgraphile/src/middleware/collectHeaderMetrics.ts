import type { Middleware } from 'koa'
import { getActiveSpan } from '../telemetry'

const HEADERS_TO_COLLECT = [
	'X-Zeepkist-Version',
	'X-Zeepkist-Major-Version',
	'X-GTR-Version',
	'X-Steam-ID',
]

export const collectHeaderMetrics: Middleware = async (ctx, next) => {
	const span = getActiveSpan()

	if (span) {
		for (const header of HEADERS_TO_COLLECT) {
			const value = ctx.headers[header.toLowerCase()]

			if (typeof value === 'string') {
				span.setAttribute(`graphql.header.${header}`, value)
			}
		}
	}

	await next()
}
