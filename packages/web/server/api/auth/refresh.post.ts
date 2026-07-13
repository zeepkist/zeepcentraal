import { refreshWebAuth } from '../../utils/backend'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	try {
		const { refreshAt } = await refreshWebAuth(event)
		return { refreshAt }
	} catch {
		setResponseStatus(event, 401)
		return { refreshAt: null }
	}
})
