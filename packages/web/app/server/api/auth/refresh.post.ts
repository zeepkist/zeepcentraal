import { refreshWebAuth } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	try {
		return await refreshWebAuth(event)
	} catch {
		setResponseStatus(event, 401)
		return { refreshAt: null }
	}
})
