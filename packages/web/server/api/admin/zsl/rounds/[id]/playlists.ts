import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'
import { fetchAuthenticatedBackend } from '../../../../../utils/backend'
import { assertSameOrigin } from '../../../../../utils/request'
import { readBoundedJson } from '../../../../../utils/zslAdmin'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	event.res.headers.set('cache-control', 'private, no-store')
	const id = getRouterParam(event, 'id')
	if (!id || !/^[1-9]\d{0,9}$/.test(id)) {
		throw createError({ status: 400, statusText: 'Invalid round ID' })
	}
	const method = event.req.method
	const path = `/admin/zsl/rounds/${id}/playlists`
	if (method === 'GET') return fetchAuthenticatedBackend(event, path, { method })
	if (method === 'POST') {
		const body = await readBoundedJson(event.req, 7 * 1024 * 1024)
		return fetchAuthenticatedBackend(event, path, { method, body })
	}
	throw createError({ status: 405, statusText: 'Method not allowed' })
})
