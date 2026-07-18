import type { GhostRecordSource, GhostVisualIdentity, ParsedPlaybackGhost } from '~/types/ghost'

export type GhostIdentityLabels = {
	unknownPlayer: string
	worldRecord: (name: string) => string
	personalBest: (name: string) => string
	ordinal: (name: string, ordinal: string) => string
}

export type GhostIdentityInput = {
	record: GhostRecordSource
	ghost?: Pick<ParsedPlaybackGhost, 'metadata'> | null
}

const COLOR_PATTERN = /^#[0-9a-f]{8}$/i
const RICH_TEXT = /<[^>]*>/g

export function buildGhostVisualIdentities(
	inputs: GhostIdentityInput[],
	labels: GhostIdentityLabels,
	locale: string,
	primaryColor: string,
	fallbackPalette: readonly string[],
	primaryRecordId = inputs[0]?.record.recordId,
): GhostVisualIdentity[] {
	const grouped = new Map<string, GhostIdentityInput[]>()
	for (const input of inputs) {
		const key = stableUserKey(input.record)
		const records = grouped.get(key)
		if (records) records.push(input)
		else grouped.set(key, [input])
	}
	const identities = new Map<number, GhostVisualIdentity>()

	for (const [userKey, records] of grouped) {
		const ordered = records.toSorted(
			(left, right) =>
				left.record.time - right.record.time ||
				left.record.recordId - right.record.recordId,
		)
		for (const [index, input] of ordered.entries()) {
			const ordinal = index + 1
			const playerName = resolvePlayerName(input, labels.unknownPlayer)
			const userRunOrdinal = ordinal > 1 ? ordinal : null
			const { bodyColor, colorSource } = resolveGhostColor(
				input,
				primaryColor,
				fallbackPalette,
				input.record.recordId === primaryRecordId,
			)
			identities.set(input.record.recordId, {
				recordId: input.record.recordId,
				userKey,
				playerName,
				label: input.record.isWorldRecord
					? labels.worldRecord(playerName)
					: input.record.isPersonalBest
						? labels.personalBest(playerName)
						: ordinal > 1
							? labels.ordinal(playerName, formatOrdinal(ordinal, locale))
							: playerName,
				isWorldRecord: input.record.isWorldRecord,
				isPersonalBest: input.record.isPersonalBest,
				userRunOrdinal,
				bodyColor,
				colorSource,
			})
		}
	}

	return inputs.flatMap(({ record }) => {
		const identity = identities.get(record.recordId)
		return identity ? [identity] : []
	})
}

export function sanitizeGhostUsername(value: string | null | undefined): string | null {
	if (!value) return null
	const sanitized = [...value.replace(RICH_TEXT, '')]
		.filter((character) => {
			const code = character.charCodeAt(0)
			return code >= 32 && code !== 127
		})
		.join('')
		.trim()
	return sanitized.length > 0 ? sanitized.slice(0, 64) : null
}

export function normalizeGhostColor(value: string | null | undefined): string | null {
	if (!value || !COLOR_PATTERN.test(value)) return null
	return value.slice(0, 7).toLowerCase()
}

export function formatOrdinal(value: number, locale: string): string {
	const pluralRules = new Intl.PluralRules(locale, { type: 'ordinal' })
	const suffixes: Record<Intl.LDMLPluralRule, string> = {
		zero: 'th',
		one: 'st',
		two: 'nd',
		few: 'rd',
		many: 'th',
		other: 'th',
	}
	return `${value}${suffixes[pluralRules.select(value)]}`
}

function resolvePlayerName(input: GhostIdentityInput, fallback: string): string {
	if (input.record.userName?.trim()) return input.record.userName.trim()
	const ghostSteamId = input.ghost?.metadata.steamId
	if (ghostSteamId && ghostSteamId === input.record.userSteamId) {
		return sanitizeGhostUsername(input.ghost?.metadata.taggedUsername) ?? fallback
	}
	return fallback
}

function resolveGhostColor(
	input: GhostIdentityInput,
	primaryColor: string,
	fallbackPalette: readonly string[],
	isPrimary: boolean,
): Pick<GhostVisualIdentity, 'bodyColor' | 'colorSource'> {
	if (input.record.isWorldRecord) {
		return { bodyColor: primaryColor, colorSource: 'world-record' }
	}
	const ghostColor = normalizeGhostColor(input.ghost?.metadata.color)
	if (ghostColor) return { bodyColor: ghostColor, colorSource: 'ghost' }
	if (isPrimary) return { bodyColor: primaryColor, colorSource: 'fallback' }
	const palette = fallbackPalette.length > 0 ? fallbackPalette : ['#38bdf8']
	return {
		bodyColor: palette[stableHash(stableUserKey(input.record)) % palette.length] ?? '#38bdf8',
		colorSource: 'fallback',
	}
}

function stableUserKey(record: GhostRecordSource): string {
	return record.userSteamId ?? `user:${record.userId}`
}

function stableHash(value: string): number {
	let hash = 2_166_136_261
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 16_777_619)
	}
	return hash >>> 0
}
