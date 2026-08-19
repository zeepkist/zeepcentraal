export const AUTH_RETURN_PATH_STORAGE_KEY = 'zeepcentraal_auth_return_path'

const invalidPercentEncoding = /%(?![\da-f]{2})/i

function containsControlCharacter(value: string) {
	return Array.from(value).some((character) => {
		const code = character.charCodeAt(0)
		return code <= 31 || code === 127
	})
}

export function resolveAuthReturnPath(value: string | null, origin: string): string | null {
	if (
		!value?.startsWith('/') ||
		value.startsWith('//') ||
		containsControlCharacter(value) ||
		invalidPercentEncoding.test(value)
	) {
		return null
	}

	try {
		const url = new URL(value, origin)
		if (url.origin !== origin) return null
		if (url.pathname === '/auth/callback') return null
		if (url.pathname === '/' && url.searchParams.get('auth') === 'callback') return null
		return `${url.pathname}${url.search}${url.hash}`
	} catch {
		return null
	}
}
