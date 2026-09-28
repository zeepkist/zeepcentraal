import { fetchAuthenticatedBackend } from './backend'
import { assertSameOrigin } from './request'

export async function readContestBackend(event: Parameters<typeof getHeader>[0], path: string) {
	assertSameOrigin(event)
	setResponseHeader(event, 'cache-control', 'private, no-store')
	const roundId = getQuery(event).roundId
	if (
		roundId !== undefined &&
		(typeof roundId !== 'string' ||
			!/^[1-9][0-9]*$/.test(roundId) ||
			Number(roundId) > 2147483647)
	) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid roundId' })
	}
	return fetchAuthenticatedBackend<unknown>(event, path, {
		method: 'GET',
		query: roundId === undefined ? undefined : { roundId },
	})
}
