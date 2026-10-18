/** Read HTTP status metadata without treating error messages as status codes. */
export function getHttpErrorStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) return
	const candidate = error as { status?: unknown; statusCode?: unknown; response?: unknown }
	const response = candidate.response
	const status =
		candidate.status ??
		candidate.statusCode ??
		(typeof response === 'object' && response !== null && 'status' in response
			? response.status
			: undefined)
	return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
		? status
		: undefined
}

export function isHttpNotFoundError(error: unknown): boolean {
	return getHttpErrorStatus(error) === 404
}
