export function isCrossOriginRequest(
	origin: string | undefined,
	fetchSite: string | undefined,
	requestOrigin: string,
) {
	return fetchSite === 'cross-site' || Boolean(origin && origin !== requestOrigin)
}

export function assertSameOrigin(event: Parameters<typeof getHeader>[0]) {
	if (
		isCrossOriginRequest(
			getHeader(event, 'origin'),
			getHeader(event, 'sec-fetch-site'),
			getRequestURL(event).origin,
		)
	) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Cross-origin API requests are not allowed',
		})
	}
}
