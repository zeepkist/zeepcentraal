import { fetchAuthenticatedBackend } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	return fetchAuthenticatedBackend<{ code: string; expiresAt: string }>(
		event,
		'/user/discord/link-code',
		{ method: 'POST' },
	)
})
