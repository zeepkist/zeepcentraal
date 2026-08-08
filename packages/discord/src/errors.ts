const MAX_ERROR_DETAIL_LENGTH = 300

function bounded(value: string) {
	const compact = value.replace(/\s+/g, ' ').trim()
	return compact.length > MAX_ERROR_DETAIL_LENGTH
		? `${compact.slice(0, MAX_ERROR_DETAIL_LENGTH - 1)}…`
		: compact
}

function structuredDetail(value: unknown): string | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const object = value as Record<string, unknown>
	for (const key of ['detail', 'message', 'error', 'title']) {
		if (typeof object[key] === 'string' && object[key]) return bounded(object[key])
	}
	return null
}

export async function backendErrorDetail(response: Response) {
	const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
	const body = await response.text().catch(() => '')
	if (!body || contentType.includes('text/html') || /^\s*(?:<!doctype|<html)/i.test(body)) {
		return null
	}
	if (contentType.includes('json')) {
		try {
			return structuredDetail(JSON.parse(body))
		} catch {
			return null
		}
	}
	return bounded(body) || null
}

export class DiscordBackendError extends Error {
	constructor(
		readonly status: number,
		readonly method: string,
		readonly path: string,
		readonly retryAfter: string | null,
		readonly detail: string | null,
	) {
		super(`Backend ${status} ${method} ${path}${detail ? `: ${detail}` : ''}`)
		this.name = 'DiscordBackendError'
	}
}

type ErrorWithResponse = Error & { response?: Response }

export function discordErrorSummary(error: unknown) {
	const summary: Record<string, unknown> = {
		message: error instanceof Error ? error.message : 'Unknown error',
		name: error instanceof Error ? error.name : 'UnknownError',
	}
	if (error instanceof DiscordBackendError) {
		summary.status = error.status
		summary.method = error.method
		summary.path = error.path
		if (error.retryAfter) summary.retryAfter = error.retryAfter
		return summary
	}
	const response = error instanceof Error ? (error as ErrorWithResponse).response : undefined
	if (response) {
		summary.status = response.status
		const queryCost = response.headers.get('x-query-cost')
		const retryAfter = response.headers.get('retry-after')
		if (queryCost) summary.queryCost = queryCost
		if (retryAfter) summary.retryAfter = retryAfter
	}
	return summary
}
