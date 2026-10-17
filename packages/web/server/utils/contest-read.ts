import { createError, getQuery, type RequestEvent } from 'nuxt/server'
import { fetchAuthenticatedBackend } from './backend'
import { assertSameOrigin } from './request'

export async function readContestBackend(event: RequestEvent, path: string) {
	assertSameOrigin(event)
	event.res.headers.set('cache-control', 'private, no-store')
	const roundId = getQuery(event).roundId
	if (
		roundId !== undefined &&
		(typeof roundId !== 'string' ||
			!/^[1-9][0-9]*$/.test(roundId) ||
			Number(roundId) > 2147483647)
	) {
		throw createError({ status: 400, statusText: 'Invalid roundId' })
	}
	return fetchAuthenticatedBackend<unknown>(event, path, {
		method: 'GET',
		query: roundId === undefined ? undefined : { roundId },
	})
}
