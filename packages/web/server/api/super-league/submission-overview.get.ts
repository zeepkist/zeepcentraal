import { createError, defineEventHandler, getQuery } from 'nuxt/server'
import type { SubmissionOverview } from '../../../app/utils/superLeagueSubmission'
import { getBackendBaseUrl } from '../../utils/backend'

export default defineEventHandler(async (event) => {
	const roundId = getQuery(event).roundId
	if (
		roundId !== undefined &&
		(typeof roundId !== 'string' ||
			!/^[1-9][0-9]*$/.test(roundId) ||
			Number(roundId) > 2147483647)
	)
		throw createError({ status: 400, statusText: 'Invalid roundId' })
	event.res.headers.set('cache-control', 'no-store')
	try {
		return await $fetch<SubmissionOverview>(
			new URL('/super-league/submission-overview', getBackendBaseUrl()).toString(),
			{
				query: roundId === undefined ? undefined : { roundId },
				credentials: 'omit',
			},
		)
	} catch {
		throw createError({
			status: 502,
			statusText: 'Submission overview could not be loaded',
		})
	}
})
