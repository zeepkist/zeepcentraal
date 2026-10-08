import { fetchAuthenticatedBackend } from '../../../../../utils/backend'
import { assertSameOrigin } from '../../../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	setHeader(event, 'cache-control', 'private, no-store')
	const id = Number(getRouterParam(event, 'id'))
	const body = await readBody<{ idLevel?: unknown }>(event)
	if (
		!Number.isSafeInteger(id) ||
		id < 1 ||
		typeof body?.idLevel !== 'number' ||
		!Number.isSafeInteger(body.idLevel) ||
		body.idLevel < 1
	) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid comparison' })
	}
	return fetchAuthenticatedBackend(event, `/admin/ghost-validation/records/${id}/compare`, {
		method: 'POST',
		body: { idLevel: body.idLevel },
	})
})
