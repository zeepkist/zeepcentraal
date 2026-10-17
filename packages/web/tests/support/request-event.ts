import type { RequestEvent } from 'nuxt/server'

export function createRequestEvent(path = '/', init?: RequestInit): RequestEvent {
	const url = new URL(path, 'https://web.example.test')
	return {
		req: new Request(url, init),
		url,
		res: { headers: new Headers() },
		context: {},
	}
}
