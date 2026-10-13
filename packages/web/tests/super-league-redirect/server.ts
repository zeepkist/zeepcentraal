import type { SubmissionContest } from '../../app/utils/superLeagueSubmission'

let fixture: { contests: SubmissionContest[]; fail?: boolean } = { contests: [] }
const headers = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }

Bun.serve({
	hostname: '127.0.0.1',
	port: 4188,
	async fetch(request) {
		const url = new URL(request.url)
		if (url.pathname === '/healthz') return new Response('ok')
		if (url.pathname === '/fixture' && request.method === 'PUT') {
			fixture = await request.json()
			return new Response(null, { status: 204 })
		}
		if (url.pathname === '/super-league/contests') {
			return fixture.fail
				? new Response('Fixture unavailable', { status: 503, headers })
				: Response.json(fixture.contests, { headers })
		}
		if (url.pathname === '/graphql') {
			return Response.json(
				{
					data: {
						zslSeasons: {
							nodes: [],
							totalCount: 0,
							pageInfo: {
								hasNextPage: false,
								hasPreviousPage: false,
								startCursor: null,
								endCursor: null,
							},
						},
					},
				},
				{ headers },
			)
		}
		const contest =
			fixture.contests.find(
				(item) => item.roundId === Number(url.searchParams.get('roundId')),
			) ?? null
		if (url.pathname === '/super-league/submission-overview')
			return Response.json(
				{ contest, validCount: 0, totalCount: 0, submissions: [] },
				{ headers },
			)
		if (url.pathname === '/super-league/submit-level')
			return Response.json({ contest, submission: null }, { headers })
		if (url.pathname === '/super-league/vote')
			return Response.json(
				contest
					? { ...contest, candidates: [], votes: [[], [], []], votingPending: false }
					: null,
				{ headers },
			)
		return new Response('Unknown fixture endpoint', { status: 404, headers })
	},
})
