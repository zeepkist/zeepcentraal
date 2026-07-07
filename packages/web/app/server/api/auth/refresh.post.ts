import { refreshWebAuth } from '../../utils/backend'

export default defineEventHandler(async (event) => {
	try {
		await refreshWebAuth(event)
		return null
	} catch {
		setResponseStatus(event, 401)
		return null
	}
})
