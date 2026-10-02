import type {
	Zc_LevelExplorerCardFragment,
	Zc_WorkshopCardFragment,
} from '@zeepkist/graphql/generated'
import { describe, expect, it } from 'vitest'
import { mapLevelSummary } from '../../app/utils/levelSummary'
import {
	buildWorkshopFilter,
	formatWorkshopFileSize,
	isWorkshopId,
	mapWorkshopPage,
	mapWorkshopSummary,
	normalizeWorkshopSort,
	WORKSHOP_SORTS,
	workshopOrderBy,
} from '../../app/utils/workshop'

describe('workshop filters and identifiers', () => {
	it('defaults to publication date and adds unique cursor tie-breakers', () => {
		for (const invalid of [undefined, null, '', 'DATE_CREATED_DESC', ['NAME_ASC']]) {
			expect(normalizeWorkshopSort(invalid)).toBe(WORKSHOP_SORTS.latest)
		}
		for (const sort of Object.values(WORKSHOP_SORTS)) {
			expect(normalizeWorkshopSort(sort)).toBe(sort)
			expect(workshopOrderBy(sort)).toEqual([sort, 'WORKSHOP_ID_DESC'])
		}
	})
	it('combines title and author filters without empty filters', () => {
		expect(buildWorkshopFilter({ search: ' ', author: '' })).toBeUndefined()
		expect(buildWorkshopFilter({ search: ' race ', author: '76561198000000001' })).toEqual({
			and: [
				{ name: { includesInsensitive: 'race' } },
				{ authorId: { equalTo: '76561198000000001' } },
			],
		})
		expect(buildWorkshopFilter({ author: ' Racer ' })).toEqual({
			and: [{ author: { steamName: { includesInsensitive: 'Racer' } } }],
		})
	})
	it('selects workshop rows through active membership, without joining duplicate files', () => {
		expect(buildWorkshopFilter({ levelId: 101 })).toEqual({
			and: [
				{
					levelItems: {
						some: { levelId: { equalTo: 101 }, deleted: { equalTo: false } },
					},
				},
			],
		})
	})
	it.each(['1', '3811536312', '9007199254740993', '9223372036854775807'])(
		'accepts exact positive ID %s',
		(value) => {
			expect(isWorkshopId(value)).toBe(true)
		},
	)
	it.each([
		'',
		'0',
		'-1',
		'01',
		'1.5',
		'1e3',
		' 123',
		'abc',
		'9223372036854775808',
		'99999999999999999999',
	])('rejects invalid ID %s', (value) => {
		expect(isWorkshopId(value)).toBe(false)
	})
})

describe('workshop presentation', () => {
	it('keeps string IDs and Steam dates, including missing author and image', () => {
		const node: Zc_WorkshopCardFragment = {
			workshopId: '9007199254740993',
			name: 'Race pack',
			imageUrl: '',
			authorId: '76561198000000001',
			author: null,
			createdAt: '2026-01-01T00:00:00Z',
			updatedAt: '2026-10-01T00:00:00Z',
			fileSize: 0,
		}
		expect(mapWorkshopSummary(node)).toEqual({
			workshopId: '9007199254740993',
			name: 'Race pack',
			imageUrl: null,
			authorSteamId: '76561198000000001',
			authorName: null,
			createdAt: node.createdAt,
			updatedAt: node.updatedAt,
			fileSize: 0,
		})
	})
	it('formats zero and large sizes with binary units', () => {
		expect(formatWorkshopFileSize(0, 'en-GB')).toBe('0 B')
		expect(formatWorkshopFileSize(1536, 'en-GB')).toBe('1.5 KiB')
		expect(formatWorkshopFileSize(1024 ** 2, 'en-GB')).toBe('1 MiB')
		expect(formatWorkshopFileSize(1024 ** 3, 'en-GB')).toBe('1 GiB')
	})
	it('preserves connection cursors and handles absent results', () => {
		expect(mapWorkshopPage()).toEqual({
			startCursor: null,
			endCursor: null,
			hasNextPage: false,
			hasPreviousPage: false,
		})
		expect(
			mapWorkshopPage({
				startCursor: 'one',
				endCursor: 'two',
				hasNextPage: true,
				hasPreviousPage: false,
			}),
		).toEqual({
			startCursor: 'one',
			endCursor: 'two',
			hasNextPage: true,
			hasPreviousPage: false,
		})
	})
	it('preserves workshop-specific metadata, metrics, medals, and playlist identity', () => {
		const node: Zc_LevelExplorerCardFragment = {
			id: 101,
			xxHash: 'canonical-hash',
			adventure: false,
			dateCreated: '2026-01-01T00:00:00Z',
			levelItems: {
				nodes: [
					{
						name: 'Pack file',
						imageUrl: 'pack.jpg',
						fileUid: 'pack-file',
						fileAuthor: 'Pack author',
						workshopId: '123',
						createdAt: '2026-01-01T00:00:00Z',
						updatedAt: '2026-01-02T00:00:00Z',
						validationTimeAuthor: 40,
						validationTimeGold: 45,
						validationTimeSilver: 50,
						validationTimeBronze: 60,
						author: { steamId: '76561198000000001', steamName: 'Pack author' },
					},
				],
			},
			levelPoints: { points: 1000, rating: 0.8 },
			records: { totalCount: 12 },
			personalBestGlobals: { totalCount: 9 },
			votes: { totalCount: 8 },
			viewerFavourites: { totalCount: 1 },
			worldRecordGlobal: {
				record: { time: 35 },
				user: { steamId: '76561198000000002', steamName: 'Fast author' },
			},
		}
		expect(mapLevelSummary(node)).toMatchObject({
			id: 101,
			xxHash: 'canonical-hash',
			name: 'Pack file',
			imageUrl: 'pack.jpg',
			fileUid: 'pack-file',
			fileAuthor: 'Pack author',
			workshopId: '123',
			favourited: true,
			points: 1000,
			rating: 0.8,
			recordCount: 12,
			personalBestCount: 9,
			voteCount: 8,
			worldRecordTime: 35,
			medals: { author: 40, gold: 45, silver: 50, bronze: 60 },
		})
	})
})
