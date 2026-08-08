import type { LinkedUser } from './types'

export function playerLabel(user: Pick<LinkedUser, 'steamName' | 'discordId'> | null | undefined) {
	const steamName = user?.steamName?.trim() || 'Unknown player'
	const discordId = user?.discordId?.toString()
	return discordId && discordId !== '-1' ? `${steamName} (<@${discordId}>)` : steamName
}

export function formatTime(seconds: number | null | undefined) {
	if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'N/A'
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds - minutes * 60
	return minutes > 0
		? `${minutes}:${remainder.toFixed(3).padStart(6, '0')}`
		: `${remainder.toFixed(3)}s`
}

export function compactNumber(value: number | string | bigint | null | undefined) {
	const number = Number(value ?? 0)
	return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(
		number,
	)
}

export function truncate(value: string, length = 1024) {
	return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

export const safeMentions = { parse: [] as Array<'roles' | 'users' | 'everyone'> }
