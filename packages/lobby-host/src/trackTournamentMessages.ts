export interface TrackTournamentLeaderboardStanding {
	rank: number
	recordId: number
	steamName: string | null
	time: number
	userId: number
}

export interface TrackTournamentJoinMessageInput {
	minimumGtrVersion: string | null
	playerName: string
	requireGtr: boolean
	standing?: { rank: number; time: number }
	type: TrackTournamentRoomType
}

const DISPLAY_NAME_MAX_CODE_POINTS = 24
const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const

export type TrackTournamentRoomType = 'weekly' | 'monthly'

export function buildTrackTournamentJoinMessage(input: TrackTournamentJoinMessageInput) {
	const weekly = input.type === 'weekly'
	const eventName = `Track of the ${weekly ? 'Week' : 'Month'}`
	const cadence = weekly ? 'week' : 'month'
	const route = weekly ? 'totw' : 'totm'
	const paragraphs = [
		`Welcome to ${eventName}, ${formatDisplayName(input.playerName)}`,
		`A time attack tournament featuring a unique level each ${cadence}.`,
		`View the full tournament leaderboard on <u>zeepki.st/${route}</u>!`,
	]
	if (input.requireGtr) {
		const minimum = formatGtrVersion(input.minimumGtrVersion)
		paragraphs.push(
			minimum
				? `You need GTR ${minimum}+ installed to join the tournament leaderboard.`
				: 'You need GTR installed to join the tournament leaderboard.',
		)
	}
	if (input.standing) {
		paragraphs.push(
			`You are currently #${input.standing.rank} on the tournament leaderboard with ${formatTrackTournamentTime(input.standing.time)}.`,
		)
	}
	paragraphs.push(
		'<size=75%>This is an unattended room, so chat is not monitored. If you find something wrong, please contact Akane on Discord.</size>',
	)
	return {
		// hostname: `---${eventName}---`,
		hostname: '<color=#facc15>[HOST]</color>',
		message: `<size=85%><#dedede>${paragraphs.join('<br><br>')}</color></size>`,
	}
}

export function buildTrackTournamentServerMessageCommand(
	type: TrackTournamentRoomType,
	tournamentSlug: string,
	tournamentEndAt: string,
	standings: readonly TrackTournamentLeaderboardStanding[] | undefined,
	entries: number | undefined,
	roundTimeSeconds: number,
	now = Date.now(),
) {
	const title = `<b>${escapeUnityRichText(formatTrackTournamentPeriod(type, tournamentSlug))}</b>`
	const remaining = formatTournamentRemaining(tournamentEndAt, now)
	const body = formatLeaderboard(standings)
	const entryCount = entries === undefined ? '…' : entries
	return `/servermessage yellow ${roundTimeSeconds} ${title}\n<size=100%>${entryCount} Entries ${remaining}\n${body}</size>`
}

export function formatTrackTournamentPeriod(type: TrackTournamentRoomType, slug: string) {
	if (type === 'weekly') {
		const match = /^(\d{4})-w(\d{2})$/.exec(slug)
		if (!match) return `Track of the Week: ${slug}`
		return `Track of the Week: ${Number(match[1])} Week ${Number(match[2])}`
	}
	const match = /^(\d{4})-(\d{2})$/.exec(slug)
	if (!match) return `Track of the Month: ${slug}`
	const month = Number(match[2])
	if (month < 1 || month > 12) return `Track of the Month: ${slug}`
	const label = new Intl.DateTimeFormat('en', {
		month: 'long',
		timeZone: 'UTC',
		year: 'numeric',
	}).format(new Date(Date.UTC(Number(match[1]), month - 1, 1)))
	return `Track of the Month: ${label}`
}

export function formatTrackTournamentTime(seconds: number) {
	const milliseconds = Math.round(seconds * 1_000)
	const minutes = Math.floor(milliseconds / 60_000)
	const secondsInMinute = (milliseconds - minutes * 60_000) / 1_000
	return `${minutes.toString().padStart(2, '0')}:${secondsInMinute.toFixed(3).padStart(6, '0')}`
}

export function formatTournamentRemaining(endAt: string, now = Date.now()) {
	const endTime = Date.parse(endAt)
	if (!Number.isFinite(endTime)) throw new Error('Tournament end time is invalid')
	const totalMinutes = Math.max(0, Math.ceil((endTime - now) / 60_000))
	const days = Math.floor(totalMinutes / (24 * 60))
	const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
	const minutes = totalMinutes % 60
	return `Ends in ${days}d ${hours}h ${minutes}m`
}

export function escapeUnityRichText(value: string) {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function leaderboardSignature(
	standings: readonly TrackTournamentLeaderboardStanding[],
	entries: number,
) {
	return JSON.stringify([
		entries,
		standings.map(({ rank, recordId, steamName, time, userId }) => [
			rank,
			recordId,
			steamName,
			time,
			userId,
		]),
	])
}

function formatLeaderboard(standings: readonly TrackTournamentLeaderboardStanding[] | undefined) {
	if (standings === undefined) return 'Leaderboard loading…'
	if (standings.length === 0) return 'Set a time with GTR to appear on the leaderboard!'
	return standings
		.slice(0, 6)
		.map((standing, index) => {
			const name = formatDisplayName(standing.steamName)
			const row = `${standing.rank}. ${name} — ${formatTrackTournamentTime(standing.time)}`
			const color = PODIUM_COLORS[index] ?? '#FFFFFF'
			return `<color=${color}>${row}</color>`
		})
		.join('\n')
}

function formatDisplayName(value: string | null) {
	const sanitized = (value ?? '')
		.replace(/[\p{Cc}\p{Cf}]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	return escapeUnityRichText(truncateName(sanitized || 'Unknown player'))
}

function formatGtrVersion(value: string | null) {
	const sanitized = (value ?? '')
		.replace(/[\p{Cc}\p{Cf}]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
	return escapeUnityRichText([...sanitized].slice(0, 32).join(''))
}

function truncateName(value: string) {
	const codePoints = [...value]
	return codePoints.length <= DISPLAY_NAME_MAX_CODE_POINTS
		? value
		: `${codePoints.slice(0, DISPLAY_NAME_MAX_CODE_POINTS - 1).join('')}…`
}
