import { expect, test } from 'bun:test'
import { STEAM_VISIBILITY } from '@zeepkist/core/steam'
import {
	hasWorkshopAccessibilityChanged,
	resolveWorkshopLevelId,
	resolveWorkshopMetadataBlocks,
} from './workshopHelpers'

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
