export function mockJsonFetch(
	handler: (url: URL) => {
		body?: unknown
		status?: number
		headers?: ConstructorParameters<typeof Headers>[0]
	},
) {
	const urls: URL[] = []
	globalThis.fetch = (async (input) => {
		const url = new URL(String(input))
		urls.push(url)
		const { body = {}, status = 200, headers = {} } = handler(url)
		const responseHeaders = new Headers(headers)
		if (!responseHeaders.has('content-type')) {
			responseHeaders.set('content-type', 'application/json')
		}
		return new Response(JSON.stringify(body), {
			status,
			headers: responseHeaders,
		})
	}) as typeof fetch
	return urls
}
