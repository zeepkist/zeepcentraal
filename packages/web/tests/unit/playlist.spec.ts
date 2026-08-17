import { describe, expect, it, vi } from 'vitest'

import type { LocalPlaylist, LocalPlaylistLevel } from '~/types/app'
import {
	clampPlaylistRoundLength,
	getUniquePlaylistName,
	importPlaylistText,
	isPlaylistDownloadable,
	normalizePlaylistFilename,
	PLAYLIST_MAX_FILE_SIZE,
	parseSafeWorkshopId,
	serializePlaylist,
} from '~/utils/playlist'

function level(UID: string, WorkshopID = 123): LocalPlaylistLevel {
	return { UID, WorkshopID, Name: `Level ${UID}`, Author: 'Author' }
}

function playlist(overrides: Partial<LocalPlaylist> = {}): LocalPlaylist {
	return {
		id: 'playlist-id',
		name: 'My Awesome Playlist',
		roundLength: 480,
		shufflePlaylist: true,
		levels: [level('uid-1', 3755704991)],
		createdAt: '2026-08-16T00:00:00.000Z',
		updatedAt: '2026-08-16T00:00:00.000Z',
		...overrides,
	}
}

describe('playlist serialization', () => {
	it('writes exact Zeepkist shape with BOM, numeric WorkshopID, indentation, and newline', () => {
		const serialized = serializePlaylist(playlist())
		expect(serialized.startsWith('\uFEFF{\n    "name"')).toBe(true)
		expect(serialized.endsWith('\n')).toBe(true)

		const parsed = JSON.parse(serialized.slice(1))
		expect(parsed).toEqual({
			name: 'My Awesome Playlist',
			amountOfLevels: 1,
			roundLength: 480,
			shufflePlaylist: true,
			UID: [],
			levels: [
				{
					UID: 'uid-1',
					WorkshopID: 3755704991,
					Name: 'Level uid-1',
					Collaborators: '',
					OverrideAuthorName: '',
					Author: 'Author',
					played: false,
				},
			],
		})
		expect(typeof parsed.levels[0].WorkshopID).toBe('number')
	})

	it('rejects empty and invalid playlists', () => {
		expect(isPlaylistDownloadable(playlist({ levels: [] }))).toBe(false)
		expect(isPlaylistDownloadable(playlist({ roundLength: 59 }))).toBe(false)
		expect(() => serializePlaylist(playlist({ levels: [] }))).toThrow(
			'Playlist is empty or invalid',
		)
	})
})

describe('playlist normalization', () => {
	it.each([
		[undefined, null],
		['9007199254740992', null],
		[-1, null],
		['123', 123],
		[123, 123],
	])('parses safe Workshop ID %j', (input, expected) => {
		expect(parseSafeWorkshopId(input)).toBe(expected)
	})

	it('clamps round duration and creates case-insensitive unique names', () => {
		expect(clampPlaylistRoundLength(10)).toBe(60)
		expect(clampPlaylistRoundLength(5000)).toBe(3600)
		expect(clampPlaylistRoundLength('bad')).toBe(480)
		expect(getUniquePlaylistName('Races', ['races', 'Races (2)'])).toBe('Races (3)')
	})

	it.each([
		['My Awesome Playlist', 'My Awesome Playlist.zeeplist'],
		['日本語 playlist', '日本語 playlist.zeeplist'],
		['bad<>:"/\\|?* name. ', 'bad name.zeeplist'],
		['CON', 'CON_.zeeplist'],
		['...', 'Playlist.zeeplist'],
	])('normalizes filename %j', (name, expected) => {
		expect(normalizePlaylistFilename(name)).toBe(expected)
	})
})

describe('playlist import', () => {
	it('imports modern BOM file offline and normalizes game-owned fields', async () => {
		const source = {
			name: 'Imported',
			amountOfLevels: 99,
			roundLength: 10,
			shufflePlaylist: true,
			UID: [],
			levels: [
				{
					UID: 'one',
					WorkshopID: '123',
					Name: 'One',
					Author: 'Alice',
					Collaborators: 'ignored',
					OverrideAuthorName: 'ignored',
					played: true,
				},
			],
		}
		const resolver = vi.fn()
		const result = await importPlaylistText(
			`\uFEFF${JSON.stringify(source)}`,
			['imported'],
			resolver,
		)

		expect(resolver).not.toHaveBeenCalled()
		expect(result.playlist.name).toBe('Imported (2)')
		expect(result.playlist.roundLength).toBe(60)
		expect(result.playlist.levels).toEqual([
			{
				UID: 'one',
				WorkshopID: 123,
				Name: 'One',
				Author: 'Alice',
				xxHash: undefined,
				imageUrl: undefined,
			},
		])
		expect(result.report.normalizedFields).toEqual(
			expect.arrayContaining([
				'WorkshopID',
				'played',
				'Collaborators',
				'OverrideAuthorName',
				'roundLength',
				'amountOfLevels',
			]),
		)
	})

	it('keeps first duplicate, skips invalid rows, and caps at 1000 levels', async () => {
		const levels = [level('duplicate'), level('duplicate')]
		for (let index = 0; index < 1001; index++) levels.push(level(`uid-${index}`))
		const result = await importPlaylistText(
			JSON.stringify({
				name: 'Large',
				roundLength: 480,
				levels: [...levels, { nope: true }],
			}),
		)

		expect(result.playlist.levels).toHaveLength(1000)
		expect(result.report.skippedDuplicates).toEqual(['duplicate'])
		expect(result.report.skippedInvalid).toBe(1)
		expect(result.report.truncatedOverflow).toBe(2)
	})

	it('resolves legacy UIDs, restores requested order, and reports unresolved entries', async () => {
		const resolver = vi.fn(async () => [level('third', 3), level('first', 1)])
		const result = await importPlaylistText(
			JSON.stringify({ name: 'Legacy', UID: ['first', 'missing', 'third', 'first'] }),
			[],
			resolver,
		)

		expect(resolver).toHaveBeenCalledWith(['first', 'missing', 'third'])
		expect(result.playlist.levels.map((item) => item.UID)).toEqual(['first', 'third'])
		expect(result.report.unresolvedLegacyUids).toEqual(['missing'])
		expect(result.report.skippedDuplicates).toEqual(['first'])
	})

	it('propagates legacy lookup failure without producing an import', async () => {
		await expect(
			importPlaylistText(JSON.stringify({ UID: ['first'] }), [], async () => {
				throw new Error('offline')
			}),
		).rejects.toThrow('offline')
	})

	it.each([
		['not-json', 'Playlist file is not valid JSON'],
		['[]', 'Playlist file must contain an object'],
		['{"UID":["first"]}', 'Legacy playlist requires an online level lookup'],
	])('rejects malformed input', async (text, message) => {
		await expect(importPlaylistText(text)).rejects.toThrow(message)
	})

	it('rejects files over 2 MiB', async () => {
		await expect(importPlaylistText(' '.repeat(PLAYLIST_MAX_FILE_SIZE + 1))).rejects.toThrow(
			'Playlist file exceeds 2 MiB',
		)
	})
})
