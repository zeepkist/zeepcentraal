import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'
import { fetchAuthenticatedBackend } from '../../../../../utils/backend'
import { assertSameOrigin } from '../../../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	event.res.headers.set('cache-control', 'private, no-store')
	const id = getRouterParam(event, 'id', { decode: true })
	if (!id || !/^[1-9][0-9]*$/.test(id)) throw createError({ status: 400 })
	return fetchAuthenticatedBackend(event, `/admin/ghost-validation/records/${id}/ghost`, {
		method: 'GET',
	})
})
