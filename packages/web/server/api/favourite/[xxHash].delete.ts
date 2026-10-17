import { createError, defineEventHandler, getRouterParam, setResponseStatus } from 'nuxt/server'
import { fetchAuthenticatedBackend } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

const XX_HASH_PATTERN = /^[0-9A-F]{32}$/

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const hash = getRouterParam(event, 'xxHash', { decode: true })
	if (!hash || !XX_HASH_PATTERN.test(hash)) {
		throw createError({ status: 400, statusText: 'Invalid level hash' })
	}

	await fetchAuthenticatedBackend(event, '/favourite/remove', {
		method: 'POST',
		body: { hash },
	})
	setResponseStatus(event, 204)
})
