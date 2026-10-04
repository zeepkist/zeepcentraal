import type { VoteResultsSnapshot } from '../../../app/utils/superLeagueVoteResults'
import { getBackendBaseUrl } from '../../utils/backend'

export default defineEventHandler(async (event) => {
	setResponseHeader(event, 'cache-control', 'no-store')
	const roundId = getQuery(event).roundId
	if (
		typeof roundId !== 'string' ||
		!/^[1-9][0-9]*$/.test(roundId) ||
		Number(roundId) > 2_147_483_647
	) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid roundId' })
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
			statusCode: error.statusCode ?? 502,
			statusMessage: 'Voting results could not be loaded',
		})
	}
})
