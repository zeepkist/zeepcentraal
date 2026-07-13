import { clearWebAuthCookies } from '../../utils/auth-cookies'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler((event) => {
	assertSameOrigin(event)
	clearWebAuthCookies(event)
	return null
})
