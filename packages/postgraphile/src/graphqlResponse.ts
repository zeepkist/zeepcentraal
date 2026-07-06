export const EVENT_STREAM_HEADER = 'X-GraphQL-Event-Stream'

export function createGraphqlResponse(response: Response, queryCost?: number) {
	const headers = new Headers(response.headers)
	headers.delete(EVENT_STREAM_HEADER)

	if (queryCost) {
		headers.set('X-Query-Cost', String(queryCost))
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

export async function readGraphqlJsonResponse(response: Response | null) {
	if (!response) {
		return { errors: [{ message: 'GraphQL response not found' }] }
	}

	const text = await response.text()
	try {
		return JSON.parse(text) as unknown
	} catch {
		return { errors: [{ message: text || 'GraphQL response was not JSON' }] }
	}
}
