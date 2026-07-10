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
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json', ...headers },
		})
	}) as typeof fetch
	return urls
}
