import { fetchAuthenticatedBackend } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	await fetchAuthenticatedBackend(event, '/user/discord', { method: 'DELETE' })
	setResponseStatus(event, 204)
})
