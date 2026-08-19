import { fetchAuthenticatedBackend } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

const XX_HASH_PATTERN = /^[0-9A-F]{32}$/

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const hash = getRouterParam(event, 'xxHash')
	if (!hash || !XX_HASH_PATTERN.test(hash)) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid level hash' })
	}

	await fetchAuthenticatedBackend(event, '/favourite/add', {
		method: 'POST',
		body: { hash },
	})
	setResponseStatus(event, 204)
})
