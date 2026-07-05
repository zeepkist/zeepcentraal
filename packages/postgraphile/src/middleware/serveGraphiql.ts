import type { Middleware } from 'koa'
import { ruruHTML } from 'ruru/server'
import { getStaticFile } from 'ruru/static'

const ruruConfig = {
	staticPath: '/ruru-static/',
	endpoint: '/',
}

export const serveGraphiql: Middleware = async (ctx, next) => {
	if (ctx.path === '/' && ctx.method === 'GET') {
		ctx.type = 'text/html'
		ctx.body = ruruHTML(ruruConfig)
		return
	}

	if (ctx.path.startsWith(ruruConfig.staticPath)) {
		const staticFile = await getStaticFile({
			staticPath: ruruConfig.staticPath,
			urlPath: ctx.url,
			acceptEncoding: ctx.headers['accept-encoding'],
			disallowDevAssets: true,
		})

		if (staticFile) {
			const { etag } = staticFile.headers

			if (etag && ctx.headers['if-none-match'] === etag) {
				ctx.status = 304
				ctx.set('etag', etag)
				return
			}

			ctx.status = 200
			ctx.set(staticFile.headers)
			ctx.body = staticFile.content
			return
		}
	}

	await next()
}
