const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SITEVERIFY_TIMEOUT_MS = 10_000

type SiteverifyResponse = {
	action?: unknown
	'error-codes'?: unknown
	hostname?: unknown
	success?: unknown
}

export type TurnstileVerificationResult =
	| { verified: true }
	| { verified: false; reason: 'rejected' | 'unavailable' }

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function verifyTurnstileToken(
	{
		token,
		secretKey,
		remoteIp,
		allowedHostnames,
	}: {
		token: string
		secretKey: string
		remoteIp?: string
		allowedHostnames: readonly string[]
	},
	dependencies: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<TurnstileVerificationResult> {
	const controller = new AbortController()
	const timeout = setTimeout(
		() => controller.abort(),
		dependencies.timeoutMs ?? SITEVERIFY_TIMEOUT_MS,
	)

	try {
		const response = await (dependencies.fetch ?? globalThis.fetch)(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				secret: secretKey,
				response: token,
				...(remoteIp && remoteIp !== 'unknown' ? { remoteip: remoteIp } : {}),
			}),
			signal: controller.signal,
		})
		if (!response.ok) return { verified: false, reason: 'unavailable' }

		const result = (await response.json()) as SiteverifyResponse
		if (result.success !== true) return { verified: false, reason: 'rejected' }
		if (result.action !== 'record-replay') return { verified: false, reason: 'rejected' }
		if (
			typeof result.hostname !== 'string' ||
			!allowedHostnames.includes(result.hostname.toLowerCase())
		) {
			return { verified: false, reason: 'rejected' }
		}

		return { verified: true }
	} catch {
		return { verified: false, reason: 'unavailable' }
	} finally {
		clearTimeout(timeout)
	}
}
