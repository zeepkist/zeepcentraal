import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { STEAM_VISIBILITY } from '@zeepkist/core/steam'
import {
	hasWorkshopAccessibilityChanged,
	resolveWorkshopLevelId,
	resolveWorkshopMetadataBlocks,
	shouldDeleteWorkshopLevelItem,
} from './workshopHelpers'

const workshopServiceSource = readFileSync(new URL('./workshop.ts', import.meta.url), 'utf8')

test('workshop refresh preserves existing Adventure status while new levels default false', () => {
	expect(workshopServiceSource).toContain(
		'.values({ hash: input.hash, xxHash: input.xxHash, adventure: false })',
	)

	const refreshStart = workshopServiceSource.indexOf('await tx\n\t\t\t.update(level)')
	const metadataStart = workshopServiceSource.indexOf('const existingMetadata', refreshStart)
	expect(refreshStart).toBeGreaterThan(-1)
	expect(metadataStart).toBeGreaterThan(refreshStart)
	expect(workshopServiceSource.slice(refreshStart, metadataStart)).not.toContain('adventure:')
})

test('Workshop and level authors are persisted separately', () => {
	expect(workshopServiceSource).toContain('authorId: input.authorId,')
	expect(workshopServiceSource).toContain('authorId: input.levelAuthorId,')
	expect(workshopServiceSource).toContain(
		'const authorIds = [...new Set([input.authorId, input.levelAuthorId])]',
	)
})

test('CSV author lookup prefers oldest active non-excluded level item', () => {
	const start = workshopServiceSource.indexOf(
		'export async function findWorkshopLevelAuthorByXxHash',
	)
	const end = workshopServiceSource.indexOf('\nexport async function upsertWorkshopLevel', start)
	const source = workshopServiceSource.slice(start, end)

	expect(source).toContain('eq(level.xxHash, xxHash)')
	expect(source).toContain('ne(levelItem.authorId, excludedAuthorId)')
	expect(source).toContain('.orderBy(asc(levelItem.deleted), asc(levelItem.id))')
})

test('concurrent canonical level insert does not abort Workshop transaction', () => {
	const insertStart = workshopServiceSource.indexOf('let createdLevel:')
	const resolutionStart = workshopServiceSource.indexOf(
		'const idLevel = resolveWorkshopLevelId',
		insertStart,
	)
	const source = workshopServiceSource.slice(insertStart, resolutionStart)

	expect(source).toContain('.onConflictDoNothing({ target: level.xxHash })')
	expect(source).not.toContain('catch (error)')
})

test('workshop accessibility treats public and unlisted as equivalent', () => {
	expect(
		hasWorkshopAccessibilityChanged(STEAM_VISIBILITY.Public, STEAM_VISIBILITY.Unlisted),
	).toBe(false)
	expect(
		hasWorkshopAccessibilityChanged(STEAM_VISIBILITY.Unlisted, STEAM_VISIBILITY.Public),
	).toBe(false)
})

test('workshop accessibility changes between accessible and inaccessible states', () => {
	expect(
		hasWorkshopAccessibilityChanged(STEAM_VISIBILITY.Public, STEAM_VISIBILITY.FriendsOnly),
	).toBe(true)
	expect(
		hasWorkshopAccessibilityChanged(STEAM_VISIBILITY.Hidden, STEAM_VISIBILITY.Unlisted),
	).toBe(true)
	expect(
		hasWorkshopAccessibilityChanged(STEAM_VISIBILITY.FriendsOnly, STEAM_VISIBILITY.Hidden),
	).toBe(false)
})

test('public and unlisted workshop levels use imported metadata blocks', () => {
	const inputBlocks = [{ id: 1 }]
	const existingBlocks = [{ id: 2 }]

	for (const visibility of [STEAM_VISIBILITY.Public, STEAM_VISIBILITY.Unlisted]) {
		expect(resolveWorkshopMetadataBlocks({ existingBlocks, inputBlocks, visibility })).toBe(
			inputBlocks,
		)
	}
})

test('inaccessible workshop levels preserve existing metadata blocks', () => {
	const inputBlocks = [{ id: 1 }]
	const existingBlocks = [{ id: 2 }]

	expect(
		resolveWorkshopMetadataBlocks({
			existingBlocks,
			inputBlocks,
			visibility: STEAM_VISIBILITY.Hidden,
		}),
	).toBe(existingBlocks)
	expect(
		resolveWorkshopMetadataBlocks({
			existingBlocks: [],
			inputBlocks,
			visibility: STEAM_VISIBILITY.FriendsOnly,
		}),
	).toEqual([])
})

test('private visibility preserves Adventure aliases and removes community aliases', () => {
	expect(shouldDeleteWorkshopLevelItem({ adventure: true, preserveAdventure: true })).toBe(false)
	expect(shouldDeleteWorkshopLevelItem({ adventure: false, preserveAdventure: true })).toBe(true)
})

test('permanently unavailable workshops remove Adventure and community aliases', () => {
	expect(shouldDeleteWorkshopLevelItem({ adventure: true, preserveAdventure: false })).toBe(true)
	expect(shouldDeleteWorkshopLevelItem({ adventure: false, preserveAdventure: false })).toBe(true)
})

test('workshop deletion paths lock parent Workshop row before changing aliases', () => {
	for (const functionName of ['markMissingWorkshopLevelsDeleted', 'markWorkshopDeleted']) {
		const start = workshopServiceSource.indexOf(`export async function ${functionName}`)
		const nextExport = workshopServiceSource.indexOf('\nexport async function ', start + 1)
		const source = workshopServiceSource.slice(
			start,
			nextExport === -1 ? workshopServiceSource.length : nextExport,
		)
		const lock = source.indexOf('FOR UPDATE')
		const itemUpdate = source.indexOf('.update(levelItem)')

		expect(start).toBeGreaterThan(-1)
		expect(source).toContain('db.transaction')
		expect(lock).toBeGreaterThan(-1)
		expect(itemUpdate).toBeGreaterThan(lock)
	}
})

test('hash merge locks every linked Workshop before moving records or deleting levels', () => {
	const start = workshopServiceSource.indexOf('export async function mergeZeepSdkExponentHash')
	const end = workshopServiceSource.indexOf(
		'\nexport async function markMissingWorkshopLevelsDeleted',
		start,
	)
	const source = workshopServiceSource.slice(start, end)
	const workshopLock = source.indexOf('FOR UPDATE')
	const recordMove = source.indexOf('.update(record)')
	const levelDelete = source.indexOf('.delete(level)')

	expect(source).toMatch(/ORDER BY \$\{workshopItem\.workshopId\}/)
	expect(source).toMatch(/\$\{levelItem\.idLevel\} IN \(\$\{correct\.id\}, \$\{bad\.id\}\)/)
	expect(workshopLock).toBeGreaterThan(-1)
	expect(recordMove).toBeGreaterThan(workshopLock)
	expect(levelDelete).toBeGreaterThan(workshopLock)
})

test('private workshop deletion joins levels before applying Adventure preservation', () => {
	const start = workshopServiceSource.indexOf('export async function markWorkshopDeleted')
	const source = workshopServiceSource.slice(start)
	const visibilityUpdate = source.indexOf('.set({ visibility: workshopVisibility })')
	const aliasDelete = source.indexOf('.update(levelItem)')

	expect(source).toContain('.innerJoin(level, eq(level.id, levelItem.idLevel))')
	expect(source).toContain('shouldDeleteWorkshopLevelItem({')
	expect(visibilityUpdate).toBeGreaterThan(-1)
	expect(aliasDelete).toBeGreaterThan(visibilityUpdate)
})

test('workshop level resolution prefers canonical xxHash row over stale file UID row', () => {
	const idLevel = resolveWorkshopLevelId({
		inputXxHash: 'B72210187A723D35B61FDAAE9A289182',
		existingItem: {
			id: 10,
			idLevel: 68219,
			deleted: false,
			xxHash: '68219',
		},
		existingByXxHash: { id: 70000 },
	})

	expect(idLevel).toBe(70000)
})

test('workshop level resolution keeps unchanged active item on same xxHash row', () => {
	const idLevel = resolveWorkshopLevelId({
		inputXxHash: 'B72210187A723D35B61FDAAE9A289182',
		existingItem: {
			id: 10,
			idLevel: 68219,
			deleted: false,
			xxHash: 'B72210187A723D35B61FDAAE9A289182',
		},
	})

	expect(idLevel).toBe(68219)
})

test('workshop level resolution falls back to duplicate legacy hash match only without canonical xxHash row', () => {
	const idLevel = resolveWorkshopLevelId({
		inputXxHash: 'B72210187A723D35B61FDAAE9A289182',
		existingItem: {
			id: 10,
			idLevel: 68219,
			deleted: false,
			xxHash: '68219',
		},
		existingByLegacyHash: { id: 70000 },
	})

	expect(idLevel).toBe(70000)
})
