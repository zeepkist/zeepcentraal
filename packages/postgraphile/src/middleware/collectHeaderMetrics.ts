import { setActiveSpanAttributes } from '@zeepkist/telemetry'

const HEADERS_TO_COLLECT = [
	'X-Zeepkist-Version',
	'X-Zeepkist-Major-Version',
	'X-GTR-Version',
	'X-Steam-ID',
]
const CLIENT_HEADER = 'X-Client'
const MAX_CLIENT_HEADER_LENGTH = 96
const CLIENT_HEADER_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9.+-]*)?$/

function getClientIdentity(headers: Headers) {
	const value = headers.get(CLIENT_HEADER)?.trim()
	if (!value || value.length > MAX_CLIENT_HEADER_LENGTH || !CLIENT_HEADER_PATTERN.test(value)) {
		return undefined
	}

	return value
}

export function collectHeaderMetrics(headers: Headers) {
	const attributes: Record<string, string> = {}

	for (const header of HEADERS_TO_COLLECT) {
		const value = headers.get(header)

		if (value) {
			attributes[`graphql.header.${header}`] = value
		}
	}

	const clientIdentity = getClientIdentity(headers)
	if (clientIdentity) {
		attributes[`graphql.header.${CLIENT_HEADER}`] = clientIdentity
	}

	setActiveSpanAttributes(attributes)
}
