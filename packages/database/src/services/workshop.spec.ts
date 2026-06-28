import { expect, test } from 'bun:test'
import { resolveWorkshopLevelId } from './workshop'

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
