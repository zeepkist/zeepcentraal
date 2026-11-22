import { createError, defineEventHandler } from 'nuxt/server'
import { fetchAuthenticatedBackend } from '../../../utils/backend'
import { assertSameOrigin } from '../../../utils/request'
import { readBoundedJson } from '../../../utils/zslAdmin'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	event.res.headers.set('cache-control', 'private, no-store')
	const method = event.req.method
	if (method === 'GET') return fetchAuthenticatedBackend(event, '/admin/zsl', { method })
	if (method === 'POST') {
		const body = await readBoundedJson(event.req, 64 * 1024)
		return fetchAuthenticatedBackend(event, '/admin/zsl', { method, body })
	}
	throw createError({ status: 405, statusText: 'Method not allowed' })
})
