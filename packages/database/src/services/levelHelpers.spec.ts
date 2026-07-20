import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolveAdventureStatus } from './levelHelpers'

const levelServiceSource = readFileSync(new URL('./level.ts', import.meta.url), 'utf8')

test('Adventure status only promotes', () => {
	expect(resolveAdventureStatus(false, false)).toBe(false)
	expect(resolveAdventureStatus(false, true)).toBe(true)
	expect(resolveAdventureStatus(true, false)).toBe(true)
	expect(resolveAdventureStatus(true, true)).toBe(true)
})

test('canonical level reuse promotes existing, legacy, and concurrent rows', () => {
	const start = levelServiceSource.indexOf(
		'export async function getOrInsertLevelWithCanonicalHash',
	)
	const end = levelServiceSource.indexOf('\nexport async function ', start + 1)
	const source = levelServiceSource.slice(start, end)

	expect(source).toContain('return updateExistingLevel(existingByXxHash)')
	expect(source).toContain('return updateExistingLevel(existingByLegacyHash, xxHash)')
	expect(source).toContain('return updateExistingLevel(concurrent)')
	expect(source).toContain('.onConflictDoNothing({ target: level.xxHash })')
})

test('canonical level updates lock linked Workshop rows in deterministic order first', () => {
	const start = levelServiceSource.indexOf('const updateExistingLevel = async')
	const end = levelServiceSource.indexOf('\n\t\tconst existingByXxHash', start)
	const source = levelServiceSource.slice(start, end)
	const workshopLock = source.indexOf('FOR UPDATE')
	const levelUpdate = source.indexOf('.update(level)')

	expect(source).toContain('ORDER BY')
	expect(source).toContain('workshopItem.workshopId')
	expect(workshopLock).toBeGreaterThan(-1)
	expect(levelUpdate).toBeGreaterThan(workshopLock)
})
