import { expect, test } from 'bun:test'
import { userPointContributionFingerprint } from './userPointContribution'

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
