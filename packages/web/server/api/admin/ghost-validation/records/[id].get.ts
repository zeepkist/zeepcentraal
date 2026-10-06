import { fetchAuthenticatedBackend } from '../../../../utils/backend'
import { assertSameOrigin } from '../../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	setHeader(event, 'cache-control', 'private, no-store')
	const id = getRouterParam(event, 'id')
	if (!id || !/^[1-9][0-9]*$/.test(id)) throw createError({ statusCode: 400 })
	return fetchAuthenticatedBackend(event, `/admin/ghost-validation/records/${id}`, {
		method: 'GET',
	})
})
