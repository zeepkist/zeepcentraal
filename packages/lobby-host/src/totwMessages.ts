export interface TotwLeaderboardStanding {
	rank: number
	recordId: number
	steamName: string | null
	time: number
	userId: number
}

const DISPLAY_NAME_MAX_CODE_POINTS = 24
const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const

export const TOTW_JOIN_MESSAGE_COMMAND = [
	'/joinmessage yellow <b>Welcome to Track of the Week!</b>',
	'<size=80%>A weekly time attack tournament on a unique track each week.',
	'Standings and previous tournaments: <u>zeepki.st/totw</u>',
	'<color=#FFCC66>GTR must be installed and running for your time to count.</color></size>',
].join('\n')

export function buildTotwServerMessageCommand(
	tournamentSlug: string,
	standings: readonly TotwLeaderboardStanding[] | undefined,
	roundTimeSeconds: number,
) {
	const title = `<b>${escapeUnityRichText(formatTotwPeriod(tournamentSlug))}</b>`
	const body = formatLeaderboard(standings)
	return `/servermessage yellow ${roundTimeSeconds} ${title}\n<size=70%>${body}</size>`
}

export function formatTotwPeriod(slug: string) {
	const match = /^(\d{4})-w(\d{2})$/.exec(slug)
	if (!match) return `Track of the Week: ${slug}`
	return `Track of the Week: ${Number(match[1])} Week ${Number(match[2])}`
}

export function formatTotwTime(seconds: number) {
	const milliseconds = Math.round(seconds * 1_000)
	const minutes = Math.floor(milliseconds / 60_000)
	const secondsInMinute = (milliseconds - minutes * 60_000) / 1_000
	return `${minutes}:${secondsInMinute.toFixed(3).padStart(6, '0')}`
}

export function escapeUnityRichText(value: string) {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function leaderboardSignature(standings: readonly TotwLeaderboardStanding[]) {
	return JSON.stringify(
		standings.map(({ rank, recordId, steamName, time, userId }) => [
			rank,
			recordId,
			steamName,
			time,
			userId,
		]),
	)
}

function formatLeaderboard(standings: readonly TotwLeaderboardStanding[] | undefined) {
	if (standings === undefined) return 'Leaderboard loading…'
	if (standings.length === 0) return 'No tournament times yet — install GTR and set first time.'
	return standings
		.slice(0, 6)
		.map((standing, index) => {
			const name = formatDisplayName(standing.steamName)
			const row = `${standing.rank}. ${name} — ${formatTotwTime(standing.time)}`
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

function truncateName(value: string) {
	const codePoints = [...value]
	return codePoints.length <= DISPLAY_NAME_MAX_CODE_POINTS
		? value
		: `${codePoints.slice(0, DISPLAY_NAME_MAX_CODE_POINTS - 1).join('')}…`
}
