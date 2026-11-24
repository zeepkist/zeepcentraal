import { createError, defineEventHandler, readBody, setResponseStatus } from 'nuxt/server'
import { isWorkshopId } from '#shared/workshopId'
import { fetchAuthenticatedBackend } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const body = await readBody<{ workshopId?: unknown } | null>(event)
	if (!isWorkshopId(body?.workshopId)) {
		throw createError({ status: 400, statusText: 'Invalid Workshop ID' })
	}
	await fetchAuthenticatedBackend(event, '/level/request', {
		method: 'POST',
		body: { workshopId: body.workshopId },
	})
	setResponseStatus(event, 204)
})
