import { describe, expect, test } from 'vitest'
import { buildTournamentPlaylist, tournamentPlaylistPath } from '../../app/utils/tournamentPlaylist'
import {
	collectTournamentPlaylistPages,
	parseTournamentPlaylistQuery,
	tournamentPlaylistIdentity,
} from '../../server/utils/tournamentPlaylist'

const level = {
	fileUid: 'level-uid',
	workshopId: '3498170115',
	name: 'Tournament Track',
	author: 'Track Author',
	validationTimeAuthor: 160,
	worldRecordTime: 150,
}

describe('Zeepkist tournament playlists', () => {
	test('maps exact playlist fields and disables shuffle for one tournament', () => {
		expect(buildTournamentPlaylist('Track of the Week', [level], 'single')).toEqual({
			name: 'Track of the Week',
			amountOfLevels: 1,
			roundLength: 450,
			shufflePlaylist: false,
			UID: [],
			levels: [
				{
					UID: 'level-uid',
					WorkshopID: '3498170115',
					Name: 'Tournament Track',
					Author: 'Track Author',
				},
			],
		})
	})

	test('uses seven-minute minimum and author-time fallback', () => {
		expect(
			buildTournamentPlaylist('Short', [{ ...level, worldRecordTime: 100 }], 'single')
				.roundLength,
		).toBe(420)
		expect(
			buildTournamentPlaylist('Fallback', [{ ...level, worldRecordTime: null }], 'single')
				.roundLength,
		).toBe(480)
	})

	test('fixes aggregate rounds to seven minutes and enables shuffle', () => {
		const playlist = buildTournamentPlaylist(
			'All tournaments',
			[level, { ...level, fileUid: 'level-uid', worldRecordTime: 500 }],
			'aggregate',
		)
		expect(playlist.roundLength).toBe(420)
		expect(playlist.shufflePlaylist).toBe(true)
		expect(playlist.amountOfLevels).toBe(2)
		expect(playlist.levels.map((entry) => entry.UID)).toEqual(['level-uid', 'level-uid'])
	})

	test('builds individual, format, and combined endpoint URLs', () => {
		expect(tournamentPlaylistPath(0, '2026-w30')).toBe(
			'/api/tournaments/playlist?type=0&slug=2026-w30',
		)
		expect(tournamentPlaylistPath(1)).toBe('/api/tournaments/playlist?type=1')
		expect(tournamentPlaylistPath()).toBe('/api/tournaments/playlist')
	})
})

describe('tournament playlist request handling', () => {
	test('accepts exact supported scopes', () => {
		expect(parseTournamentPlaylistQuery({})).toEqual({})
		expect(parseTournamentPlaylistQuery({ type: '0' })).toEqual({ type: 0 })
		expect(parseTournamentPlaylistQuery({ type: '1', slug: '2026-07' })).toEqual({
			type: 1,
			slug: '2026-07',
		})
	})

	test('creates stable attachment names for every scope', () => {
		expect(tournamentPlaylistIdentity({ type: 0, slug: '2026-w01' })).toEqual({
			filename: 'zeepcentraal-totw-2026-w01.zeeplist',
			name: 'ZeepCentraal Track of the Week 2026 Week 1',
		})
		expect(tournamentPlaylistIdentity({ type: 1 })).toEqual({
			filename: 'zeepcentraal-totm-all.zeeplist',
			name: 'ZeepCentraal Track of the Month',
		})
		expect(tournamentPlaylistIdentity({})).toEqual({
			filename: 'zeepcentraal-tournaments-all.zeeplist',
			name: 'ZeepCentraal Track Tournaments',
		})
	})

	test('rejects ambiguous or non-canonical scopes', () => {
		expect(() => parseTournamentPlaylistQuery({ slug: '2026-w30' })).toThrow()
		expect(() => parseTournamentPlaylistQuery({ type: '2' })).toThrow()
		expect(() => parseTournamentPlaylistQuery({ type: '0', slug: '2026-07' })).toThrow()
		expect(() => parseTournamentPlaylistQuery({ type: '1', slug: '2026-13' })).toThrow()
	})

	test('collects cursor pages without deduplicating repeated levels', async () => {
		const afterValues: Array<string | undefined> = []
		const nodes = await collectTournamentPlaylistPages(async (after) => {
			afterValues.push(after)
			return after
				? { nodes: ['same'], pageInfo: { hasNextPage: false } }
				: { nodes: ['same'], pageInfo: { hasNextPage: true, endCursor: 'next' } }
		})
		expect(afterValues).toEqual([undefined, 'next'])
		expect(nodes).toEqual(['same', 'same'])
	})
})
