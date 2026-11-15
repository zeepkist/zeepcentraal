import { createError, defineEventHandler } from 'nuxt/server'
import type { SubmissionContest } from '../../../app/utils/superLeagueSubmission'
import { getBackendBaseUrl } from '../../utils/backend'

export default defineEventHandler(async (event) => {
	event.res.headers.set('cache-control', 'no-store')
	try {
		return await $fetch<SubmissionContest[]>(
			new URL('/super-league/contests', getBackendBaseUrl()).toString(),
			{ credentials: 'omit', cache: 'no-store' },
		)
	} catch {
		throw createError({ status: 502, statusText: 'Super League contests could not be loaded' })
	}
})
