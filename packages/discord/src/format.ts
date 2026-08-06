import { type APIEmbed, Colors } from 'discord.js'
import type { LinkedUser } from './types'

export const EMBED_COLOR = Colors.Yellow
export const SUCCESS_COLOR = Colors.Green
export const ERROR_COLOR = Colors.Red

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

export function baseEmbed(title: string, description?: string): APIEmbed {
	return {
		color: EMBED_COLOR,
		title,
		description,
		timestamp: new Date().toISOString(),
		footer: { text: 'ZeepCentraal' },
	}
}

export function errorEmbed(message: string): APIEmbed {
	return { ...baseEmbed('Request failed', message), color: ERROR_COLOR }
}

export const safeMentions = { parse: [] as Array<'roles' | 'users' | 'everyone'> }
