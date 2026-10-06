import { fetchAuthenticatedBackend } from '../../../utils/backend'
import { assertSameOrigin } from '../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	setHeader(event, 'cache-control', 'private, no-store')
	return fetchAuthenticatedBackend(event, '/admin/ghost-validation/audit', {
		method: 'POST',
		body: await readBody(event),
	})
})
