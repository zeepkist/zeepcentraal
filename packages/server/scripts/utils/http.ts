export const PRODUCTION_BACKEND_URL = 'https://backend.zeepki.st'

export type JobTriggerTarget = 'local' | 'production'

export type JobTriggerEnvironment = Record<string, string | undefined> & {
	BACKEND_URL?: string
}

export interface JobTriggerRequest {
	Options: Record<string, unknown>
	Task: string
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface SendJobTriggerRequestOptions {
	fetchImpl?: FetchLike
	request: JobTriggerRequest
	token: string
	url: string | URL
}

export interface JobTriggerRequestResult {
	status: number
}

interface ParsedErrorResponse {
	errorCode?: number | string
	message: string
}

export class JobTriggerHttpError extends Error {
	readonly status: number
	readonly errorCode?: number | string
	readonly retryAfter?: string

	constructor({
		status,
		errorCode,
		message,
		retryAfter,
	}: {
		status: number
		errorCode?: number | string
		message: string
		retryAfter?: string
	}) {
		const codeSuffix = errorCode === undefined ? '' : `, errorCode ${errorCode}`
		const retrySuffix = retryAfter === undefined ? '' : ` Retry after: ${retryAfter}.`
		super(`Job trigger request failed (${status}${codeSuffix}): ${message}.${retrySuffix}`)
		this.name = 'JobTriggerHttpError'
		this.status = status
		this.errorCode = errorCode
		this.retryAfter = retryAfter
	}
}

export function resolveBackendUrl(
	target: JobTriggerTarget,
	environment: JobTriggerEnvironment = process.env,
): string {
	if (target === 'production') {
		return PRODUCTION_BACKEND_URL
	}

	const backendUrl = environment.BACKEND_URL?.trim()
	if (!backendUrl) {
		throw new Error('BACKEND_URL is not defined')
	}

	return backendUrl
}

export function buildJobTriggerUrl(backendUrl: string): string {
	let url: URL
	try {
		url = new URL(backendUrl)
	} catch {
		throw new Error('BACKEND_URL must be a valid HTTP URL')
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('BACKEND_URL must use HTTP or HTTPS')
	}

	const pathname = url.pathname.replace(/\/+$/, '')
	url.pathname = pathname.endsWith('/job/trigger') ? pathname : `${pathname}/job/trigger`
	url.search = ''
	url.hash = ''

	return url.toString()
}

export async function sendJobTriggerRequest({
	url,
	token,
	request,
	fetchImpl = fetch,
}: SendJobTriggerRequestOptions): Promise<JobTriggerRequestResult> {
	if (!token.trim()) {
		throw new Error('TRIGGER_JOB_TOKEN is not defined')
	}

	let response: Response
	try {
		response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(request),
		})
	} catch {
		throw new Error('Job trigger request failed before receiving a response')
	}

	if (response.ok) {
		return { status: response.status }
	}

	const responseText = redactSecret(await response.text(), token)
	const parsedError = parseErrorResponse(responseText, redactSecret(response.statusText, token))
	const retryAfterHeader = response.headers.get('Retry-After')
	const retryAfter = retryAfterHeader ? redactSecret(retryAfterHeader, token) : undefined

	throw new JobTriggerHttpError({
		status: response.status,
		errorCode: parsedError.errorCode,
		message: parsedError.message,
		retryAfter,
	})
}

function parseErrorResponse(responseText: string, statusText: string): ParsedErrorResponse {
	if (!responseText) {
		return { message: statusText || 'Unknown error' }
	}

	try {
		const body = JSON.parse(responseText) as unknown
		if (isRecord(body)) {
			if (typeof body.detail === 'string') {
				return {
					errorCode:
						typeof body.errorCode === 'number' || typeof body.errorCode === 'string'
							? body.errorCode
							: undefined,
					message: body.detail,
				}
			}

			if (typeof body.message === 'string') {
				return { message: body.message }
			}
		}
	} catch {
		// Non-JSON responses are shown as plain text.
	}

	return { message: responseText }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function redactSecret(value: string, secret: string): string {
	return secret ? value.replaceAll(secret, '[REDACTED]') : value
}
