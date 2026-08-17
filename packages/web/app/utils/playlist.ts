import type { LocalPlaylist, LocalPlaylistLevel, PlaylistImportReport } from '~/types/app'

export const PLAYLIST_DEFAULT_NAME = 'Untitled Playlist'
export const PLAYLIST_DEFAULT_ROUND_LENGTH = 480
export const PLAYLIST_MIN_ROUND_LENGTH = 60
export const PLAYLIST_MAX_ROUND_LENGTH = 3600
export const PLAYLIST_ROUND_LENGTH_STEP = 30
export const PLAYLIST_MAX_LEVELS = 1000
export const PLAYLIST_MAX_FILE_SIZE = 2 * 1024 * 1024

type LegacyLevelResolver = (uids: string[]) => Promise<LocalPlaylistLevel[]>

type ImportedPlaylist = {
	playlist: LocalPlaylist
	report: PlaylistImportReport
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function clampPlaylistRoundLength(value: unknown): number {
	const numeric = typeof value === 'string' && value.trim() ? Number(value) : value
	if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
		return PLAYLIST_DEFAULT_ROUND_LENGTH
	}
	return Math.min(
		PLAYLIST_MAX_ROUND_LENGTH,
		Math.max(PLAYLIST_MIN_ROUND_LENGTH, Math.round(numeric)),
	)
}

export function parseSafeWorkshopId(value: unknown): number | null {
	const numeric =
		typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value
	return typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric >= 0
		? numeric
		: null
}

export function getUniquePlaylistName(name: string, existingNames: readonly string[]): string {
	const base = name.trim() || PLAYLIST_DEFAULT_NAME
	const used = new Set(existingNames.map((value) => value.trim().toLocaleLowerCase()))
	if (!used.has(base.toLocaleLowerCase())) return base

	let suffix = 2
	while (used.has(`${base} (${suffix})`.toLocaleLowerCase())) suffix++
	return `${base} (${suffix})`
}

export function createLocalPlaylist(
	existingNames: readonly string[] = [],
	name = PLAYLIST_DEFAULT_NAME,
): LocalPlaylist {
	const now = new Date().toISOString()
	return {
		id: crypto.randomUUID(),
		name: getUniquePlaylistName(name, existingNames),
		roundLength: PLAYLIST_DEFAULT_ROUND_LENGTH,
		shufflePlaylist: false,
		levels: [],
		createdAt: now,
		updatedAt: now,
	}
}

export function normalizePlaylistFilename(name: string): string {
	const withoutControlCharacters = [...name]
		.filter((character) => (character.codePointAt(0) ?? 0) >= 32)
		.join('')
	const withoutInvalid = withoutControlCharacters
		.replace(/[<>:"/\\|?*]/g, '')
		.replace(/[ .]+$/g, '')
	let safeName = withoutInvalid.trimStart() || 'Playlist'
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safeName)) safeName = `${safeName}_`
	return `${safeName}.zeeplist`
}

export function isPlaylistDownloadable(playlist: LocalPlaylist | null | undefined): boolean {
	return Boolean(
		playlist?.name.trim() &&
			playlist.levels.length > 0 &&
			playlist.levels.length <= PLAYLIST_MAX_LEVELS &&
			playlist.roundLength >= PLAYLIST_MIN_ROUND_LENGTH &&
			playlist.roundLength <= PLAYLIST_MAX_ROUND_LENGTH &&
			playlist.levels.every(
				(level) => level.UID && parseSafeWorkshopId(level.WorkshopID) !== null,
			),
	)
}

export function serializePlaylist(playlist: LocalPlaylist): string {
	if (!isPlaylistDownloadable(playlist)) throw new Error('Playlist is empty or invalid')
	const output = {
		name: playlist.name.trim(),
		amountOfLevels: playlist.levels.length,
		roundLength: clampPlaylistRoundLength(playlist.roundLength),
		shufflePlaylist: playlist.shufflePlaylist,
		UID: [],
		levels: playlist.levels.map((level) => ({
			UID: level.UID,
			WorkshopID: level.WorkshopID,
			Name: level.Name,
			Collaborators: '',
			OverrideAuthorName: '',
			Author: level.Author,
			played: false,
		})),
	}
	return `\uFEFF${JSON.stringify(output, null, 4)}\n`
}

function normalizeImportedLevel(
	value: unknown,
	report: PlaylistImportReport,
): LocalPlaylistLevel | null {
	if (!isRecord(value)) return null
	const UID = typeof value.UID === 'string' ? value.UID.trim() : ''
	const WorkshopID = parseSafeWorkshopId(value.WorkshopID)
	if (!UID || WorkshopID === null) return null
	if (typeof value.WorkshopID === 'string') report.normalizedFields.push('WorkshopID')
	if (value.played !== false) report.normalizedFields.push('played')
	if (value.Collaborators !== '') report.normalizedFields.push('Collaborators')
	if (value.OverrideAuthorName !== '') report.normalizedFields.push('OverrideAuthorName')
	return {
		UID,
		WorkshopID,
		Name: typeof value.Name === 'string' && value.Name.trim() ? value.Name : UID,
		Author: typeof value.Author === 'string' ? value.Author : '',
		xxHash: typeof value.xxHash === 'string' ? value.xxHash : undefined,
		imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
	}
}

function getLegacyUids(value: Record<string, unknown>): string[] {
	if (Array.isArray(value.UID)) {
		return value.UID.filter((uid): uid is string => typeof uid === 'string')
			.map((uid) => uid.trim())
			.filter(Boolean)
	}
	if (Array.isArray(value.levels) && value.levels.every((level) => typeof level === 'string')) {
		return (value.levels as string[]).map((uid) => uid.trim()).filter(Boolean)
	}
	return []
}

function dedupeAndCapLevels(levels: LocalPlaylistLevel[], report: PlaylistImportReport) {
	const seen = new Set<string>()
	const result: LocalPlaylistLevel[] = []
	for (const level of levels) {
		if (seen.has(level.UID)) {
			report.skippedDuplicates.push(level.UID)
			continue
		}
		seen.add(level.UID)
		if (result.length >= PLAYLIST_MAX_LEVELS) {
			report.truncatedOverflow++
			continue
		}
		result.push(level)
	}
	return result
}

export async function importPlaylistText(
	text: string,
	existingNames: readonly string[] = [],
	resolveLegacy?: LegacyLevelResolver,
): Promise<ImportedPlaylist> {
	if (new TextEncoder().encode(text).byteLength > PLAYLIST_MAX_FILE_SIZE) {
		throw new Error('Playlist file exceeds 2 MiB')
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(text.replace(/^\uFEFF/, ''))
	} catch {
		throw new Error('Playlist file is not valid JSON')
	}
	if (!isRecord(parsed)) throw new Error('Playlist file must contain an object')

	const report: PlaylistImportReport = {
		normalizedFields: [],
		skippedDuplicates: [],
		skippedInvalid: 0,
		truncatedOverflow: 0,
		unresolvedLegacyUids: [],
	}
	let levels: LocalPlaylistLevel[] = []
	const modernLevels = Array.isArray(parsed.levels)
		? parsed.levels.filter((level) => typeof level !== 'string')
		: []
	if (modernLevels.length > 0) {
		for (const value of modernLevels) {
			const level = normalizeImportedLevel(value, report)
			if (level) levels.push(level)
			else report.skippedInvalid++
		}
	} else {
		const requestedUids = dedupeAndCapLevels(
			getLegacyUids(parsed).map((UID) => ({ UID, WorkshopID: 0, Name: UID, Author: '' })),
			report,
		).map((level) => level.UID)
		if (requestedUids.length > 0) {
			if (!resolveLegacy) throw new Error('Legacy playlist requires an online level lookup')
			const resolved = await resolveLegacy(requestedUids)
			const byUid = new Map(resolved.map((level) => [level.UID, level]))
			levels = requestedUids.flatMap((uid) => {
				const level = byUid.get(uid)
				if (!level) report.unresolvedLegacyUids.push(uid)
				return level ? [level] : []
			})
		}
	}
	levels = dedupeAndCapLevels(levels, report)

	const now = new Date().toISOString()
	const rawName = typeof parsed.name === 'string' ? parsed.name : PLAYLIST_DEFAULT_NAME
	const roundLength = clampPlaylistRoundLength(parsed.roundLength)
	if (roundLength !== parsed.roundLength) report.normalizedFields.push('roundLength')
	if (parsed.amountOfLevels !== levels.length) report.normalizedFields.push('amountOfLevels')
	return {
		playlist: {
			id: crypto.randomUUID(),
			name: getUniquePlaylistName(rawName, existingNames),
			roundLength,
			shufflePlaylist: parsed.shufflePlaylist === true,
			levels,
			createdAt: now,
			updatedAt: now,
		},
		report,
	}
}

export function downloadPlaylist(playlist: LocalPlaylist) {
	const blob = new Blob([serializePlaylist(playlist)], { type: 'application/json;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = normalizePlaylistFilename(playlist.name)
	link.click()
	URL.revokeObjectURL(url)
}
