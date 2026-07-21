import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
	sortedUniqueUserIds,
	userPointContributionFingerprint,
} from './userPointContributionHelpers'

test('user contribution lock targets are sorted and unique', () => {
	expect(sortedUniqueUserIds([9, 2, 9, 4, 2])).toEqual([2, 4, 9])
})

test('comparison and delta persistence share advisory-lock transaction', () => {
	const service = readFileSync(new URL('./userPointContribution.ts', import.meta.url), 'utf8')
	const transactionStart = service.indexOf('await db.transaction(async (tx) => {')
	const lock = service.indexOf(
		'await acquireUserContributionLocks(tx, idUsers)',
		transactionStart,
	)
	const read = service.indexOf('const existingRows = await tx', lock)
	const insertion = service.indexOf('.onConflictDoUpdate({', read)
	const deletion = service.indexOf('await tx.delete(userPointContribution).where', insertion)

	expect(transactionStart).toBeGreaterThan(-1)
	expect(lock).toBeGreaterThan(transactionStart)
	expect(read).toBeGreaterThan(lock)
	expect(insertion).toBeGreaterThan(read)
	expect(deletion).toBeGreaterThan(insertion)
	expect(service).toContain('const WRITE_BATCH_SIZE = 5000')
	expect(service).toContain('IS DISTINCT FROM ROW(')
	expect(service).not.toContain('const existingRows = await db')
})

test('user point contribution fingerprint ignores sub-millipoint float noise', () => {
	const first = userPointContributionFingerprint([
		{
			idLevel: 1,
			idRecord: 10,
			contributionRank: 1,
			levelPosition: 2,
			levelPoints: 1000,
			levelDecayedPoints: 984.9999,
			playerDecayedPoints: 984.9999,
		},
	])
	const second = userPointContributionFingerprint([
		{
			idLevel: 1,
			idRecord: 10,
			contributionRank: 1,
			levelPosition: 2,
			levelPoints: 1000,
			levelDecayedPoints: 985.0001,
			playerDecayedPoints: 985.0001,
		},
	])

	expect(first).toBe(second)
})

test('user point contribution fingerprint tracks contribution rank and record changes', () => {
	const base = userPointContributionFingerprint([
		{
			idLevel: 1,
			idRecord: 10,
			contributionRank: 1,
			levelPosition: 2,
			levelPoints: 1000,
			levelDecayedPoints: 985,
			playerDecayedPoints: 985,
		},
	])
	const changed = userPointContributionFingerprint([
		{
			idLevel: 1,
			idRecord: 11,
			contributionRank: 2,
			levelPosition: 2,
			levelPoints: 1000,
			levelDecayedPoints: 985,
			playerDecayedPoints: 935.75,
		},
	])

	expect(base).not.toBe(changed)
})
