import { ruruHTML } from 'ruru/server'
import { getStaticFile } from 'ruru/static'

const ruruConfig = {
	staticPath: '/ruru-static/',
	endpoint: '/',
}

const ruruHtmlByOrigin = new Map<string, string>()

function getPublicHttpProtocol(request: Request, url: URL): 'http:' | 'https:' {
	const forwardedProtocol = request.headers
		.get('x-forwarded-proto')
		?.split(',', 1)[0]
		?.trim()
		.toLowerCase()

	if (forwardedProtocol === 'http' || forwardedProtocol === 'https') {
		return `${forwardedProtocol}:`
	}

	return url.protocol === 'https:' ? 'https:' : 'http:'
}

function getRuruHtml(request: Request) {
	const url = new URL(request.url)
	const publicHttpProtocol = getPublicHttpProtocol(request, url)
	const origin = `${publicHttpProtocol}//${url.host}`
	const cached = ruruHtmlByOrigin.get(origin)
	if (cached) {
		return cached
	}

	const websocketProtocol = publicHttpProtocol === 'https:' ? 'wss:' : 'ws:'
	const html = ruruHTML({
		...ruruConfig,
		subscriptions: true,
		subscriptionEndpoint: `${websocketProtocol}//${url.host}/`,
	})
	ruruHtmlByOrigin.set(origin, html)
	return html
}

export async function serveGraphiql(request: Request): Promise<Response | null> {
	const url = new URL(request.url)
	if (url.pathname === '/' && request.method === 'GET') {
		return new Response(getRuruHtml(request), {
			headers: {
				'content-type': 'text/html; charset=utf-8',
			},
		})
	}

	if (url.pathname.startsWith(ruruConfig.staticPath)) {
		const staticFile = await getStaticFile({
			staticPath: ruruConfig.staticPath,
			urlPath: `${url.pathname}${url.search}`,
			acceptEncoding: request.headers.get('accept-encoding') ?? undefined,
			disallowDevAssets: true,
		})

		if (staticFile) {
			const { etag } = staticFile.headers

			if (etag && request.headers.get('if-none-match') === etag) {
				return new Response(null, {
					status: 304,
					headers: { etag },
				})
			}

			return new Response(staticFile.content, {
				status: 200,
				headers: staticFile.headers,
			})
		}
	}

	return null
}
