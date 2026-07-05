import { setActiveSpanAttributes } from '@zeepkist/telemetry'

const HEADERS_TO_COLLECT = [
	'X-Zeepkist-Version',
	'X-Zeepkist-Major-Version',
	'X-GTR-Version',
	'X-Steam-ID',
]

export function collectHeaderMetrics(headers: Headers) {
	const attributes: Record<string, string> = {}

	for (const header of HEADERS_TO_COLLECT) {
		const value = headers.get(header)

		if (value) {
			attributes[`graphql.header.${header}`] = value
		}
	}

	setActiveSpanAttributes(attributes)
}
