import type { LevelSummary } from '~/types/app'
import { normalizePlaylistFilename } from './playlist'

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

export type PublicSubmission = {
	id: number
	workshopId: string
	fileUid: string
	name: string
	authors: string[]
	authorNames: string[]
	level: LevelSummary
}
export type SubmissionOverview = {
	contest: SubmissionContest | null
	validCount: number
	totalCount: number
	submissions: PublicSubmission[]
}

/** Emit decimal Workshop IDs as JSON numbers without converting through JavaScript Number. */
export function serializeSubmissionPlaylist(name: string, submissions: PublicSubmission[]) {
	const levels = submissions.map((entry) => {
		if (!/^[1-9][0-9]{0,18}$/.test(entry.workshopId) || !entry.fileUid)
			throw new Error('Invalid submission playlist entry')
		return `{${JSON.stringify('UID')}:${JSON.stringify(entry.fileUid)},"WorkshopID":${entry.workshopId},"Name":${JSON.stringify(entry.name)},"Author":${JSON.stringify(entry.authorNames.join(', '))}}`
	})
	return `{"name":${JSON.stringify(name)},"amountOfLevels":${levels.length},"roundLength":480,"shufflePlaylist":false,"UID":${JSON.stringify(submissions.map((entry) => entry.fileUid))},"levels":[${levels.join(',')}]}`
}

export function downloadSubmissionPlaylist(
	contest: SubmissionContest,
	submissions: PublicSubmission[],
) {
	const name = `${contest.name} - Submissions`
	const url = URL.createObjectURL(
		new Blob([serializeSubmissionPlaylist(name, submissions)], {
			type: 'application/json;charset=utf-8',
		}),
	)
	const link = document.createElement('a')
	link.href = url
	link.download = normalizePlaylistFilename(name)
	link.click()
	URL.revokeObjectURL(url)
}
