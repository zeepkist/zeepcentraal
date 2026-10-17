import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import type { VoteResultsSnapshot } from '../../../app/utils/superLeagueVoteResults'
import { getBackendBaseUrl } from '../../utils/backend'

export default defineEventHandler(async (event) => {
	event.res.headers.set('cache-control', 'no-store')
	const roundId = getQuery(event).roundId
	if (
		typeof roundId !== 'string' ||
		!/^[1-9][0-9]*$/.test(roundId) ||
		Number(roundId) > 2_147_483_647
	) {
		throw createError({ status: 400, statusText: 'Invalid roundId' })
	}
	try {
		return await $fetch<VoteResultsSnapshot>(
			new URL('/super-league/vote-results', getBackendBaseUrl()).toString(),
			{
				query: { roundId },
				credentials: 'omit',
			},
		)
	} catch (cause) {
		const error = cause as { statusCode?: number }
		throw createError({
			status: error.statusCode ?? 502,
			statusText: 'Voting results could not be loaded',
		})
	}
})
