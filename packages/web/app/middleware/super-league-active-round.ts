import { superLeagueActiveRound } from '~/utils/superLeagueRoutes'
import type { SubmissionContest } from '~/utils/superLeagueSubmission'

export default defineNuxtRouteMiddleware(async (to) => {
	const activity =
		to.path === '/super-league/vote'
			? 'vote'
			: to.path === '/super-league/submit-level'
				? 'submit-level'
				: null
	if (!activity || Object.hasOwn(to.query, 'roundId')) return

	const config = useRuntimeConfig()
	if (import.meta.server) useResponseHeader('cache-control').value = 'no-store'
	let roundId: number | undefined
	try {
		const contests = await $fetch<SubmissionContest[]>(
			new URL('/super-league/contests', String(config.public.backendUrl)).toString(),
			{ credentials: 'omit', cache: 'no-store' },
		)
		roundId = superLeagueActiveRound(contests, activity)
	} catch {
		// Entry URLs remain safe destinations when contest availability cannot be resolved.
	}
	return navigateTo(
		roundId === undefined
			? '/super-league'
			: { path: to.path, query: { ...to.query, roundId: String(roundId) }, hash: to.hash },
		{ redirectCode: 302, replace: true },
	)
})
