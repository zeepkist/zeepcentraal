export type SuperLeagueVoteCandidate = {
	levelId: number
	workshopId: number
	xxHash: string
	adventure: boolean
	dateCreated: string
	name: string | null
	imageUrl: string | null
	authorName: string | null
	selfAuthored: boolean
}

export type SuperLeagueVoteSnapshot = {
	roundId: number
	contestId: number | null
	submissionStart: string | null
	submissionEnd: string | null
	zslVoteEnd: string | null
	cosmeticVoteEnd: string | null
	submissionsOpen: boolean
	votingPending: boolean
	openTypes: number[]
	candidates: SuperLeagueVoteCandidate[]
	votes: number[][]
}

export function useSuperLeagueVote(roundId?: number) {
	const config = useRuntimeConfig()
	const session = useSessionStore()
	const snapshot = shallowRef<SuperLeagueVoteSnapshot | null>(null)
	const pending = ref(false)
	const error = shallowRef<string | null>(null)

	async function refresh() {
		if (!session.user) return
		pending.value = true
		error.value = null
		try {
			snapshot.value = await $fetch<SuperLeagueVoteSnapshot | null>(
				new URL('/super-league/vote', String(config.public.backendUrl)).toString(),
				{ credentials: 'include', query: roundId ? { roundId } : undefined },
			)
		} catch (cause) {
			error.value = cause instanceof Error ? cause.message : 'Could not load contest voting'
		} finally {
			pending.value = false
		}
	}

	onMounted(refresh)
	watch(() => session.user?.id, refresh)
	return { snapshot, pending, error, refresh }
}
