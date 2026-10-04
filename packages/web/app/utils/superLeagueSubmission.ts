export type SubmissionAuthor = { steamId: string; steamName: string }
export function submissionAuthorChoices(
	term: string,
	users: { steamId: string | null; steamName: string | null }[],
	excluded: string[],
): SubmissionAuthor[] {
	if (!users.length && /^7656119[0-9]{10}$/.test(term) && !excluded.includes(term))
		return [{ steamId: term, steamName: 'Steam account' }]
	return users.flatMap((user) =>
		user.steamId && !excluded.includes(String(user.steamId))
			? [{ steamId: String(user.steamId), steamName: user.steamName ?? String(user.steamId) }]
			: [],
	)
}
export type SubmissionContest = {
	roundId: number
	contestId: number
	seasonId: number
	round: number
	name: string
	rules: Record<string, unknown>
	steamAnnouncementId: string | null
	submissionStart: string | null
	submissionEnd: string | null
	zslVoteEnd: string | null
	cosmeticVoteEnd: string | null
	submissionsOpen: boolean
	openTypes: number[]
	resultTypes: number[]
}
export type SubmissionValidation = {
	valid: boolean
	workshopUpdatedAt: string
	fileUid: string | null
	measurements: { blocks?: number; checkpoints?: number; authorTime?: number; modes?: string[] }
	failures: string[]
}
export type LevelSubmission = {
	id: number
	roundId: number
	workshopId: string
	authors: string[]
	authorNames: string[]
	revision: number
	status: 'queued' | 'validating' | 'retrying' | 'complete' | 'withdrawn'
	validation: SubmissionValidation | null
}
export function submissionWorkshopId(url: string): string | null {
	return (
		/^https:\/\/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=([1-9][0-9]{0,18})$/.exec(
			url.trim(),
		)?.[1] ?? null
	)
}
export function submissionProcessing(status: LevelSubmission['status'] | undefined): boolean {
	return status === 'queued' || status === 'validating' || status === 'retrying'
}

export function steamContestAnnouncementUrl(id: string | null | undefined): string | null {
	return id && /^[1-9][0-9]*$/.test(id)
		? `https://steamcommunity.com/games/1440670/announcements/detail/${id}`
		: null
}

export function submissionRuleLimits(rules: Record<string, unknown>) {
	const number = (key: string, fallback: number) =>
		typeof rules[key] === 'number' && Number.isFinite(rules[key])
			? (rules[key] as number)
			: fallback
	return {
		minTime: number('minTime', 25),
		maxTime: number('maxTime', 60),
		maxBlocks: number('maxBlocks', 3000),
		minCheckpoints: number('minCheckpoints', 3),
	}
}
