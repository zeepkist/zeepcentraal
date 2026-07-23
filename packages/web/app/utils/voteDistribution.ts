export const VOTE_DISTRIBUTION_VALUES = [2, 1, 0, -1, -2] as const

export type VoteDistributionValue = (typeof VOTE_DISTRIBUTION_VALUES)[number]
export type VoteDistributionCounts = Record<VoteDistributionValue, number>

export type VoteAggregateGroup = {
	keys?: readonly unknown[] | null
	sum?: { value?: unknown } | null
}

export function buildVoteDistributionCounts(
	groups: readonly VoteAggregateGroup[] | null | undefined,
	totalCount: number,
): VoteDistributionCounts {
	const counts: VoteDistributionCounts = { 2: 0, 1: 0, 0: 0, [-1]: 0, [-2]: 0 }
	const total = Number.isSafeInteger(totalCount) && totalCount >= 0 ? totalCount : 0

	for (const group of groups ?? []) {
		const value = parseVoteValue(group.keys?.[0])
		if (value === null || value === 0) continue

		const sum = parseInteger(group.sum?.value)
		if (sum === null) continue

		const divisor = BigInt(Math.abs(value))
		const magnitude = sum < 0n ? -sum : sum
		if (magnitude % divisor !== 0n) continue

		const count = Number(magnitude / divisor)
		if (!Number.isSafeInteger(count) || count < 0 || count > total) continue
		counts[value] = count
	}

	const nonZeroTotal = counts[2] + counts[1] + counts[-1] + counts[-2]
	counts[0] = Math.max(0, total - nonZeroTotal)
	return counts
}

export function voteDistributionTotal(counts: VoteDistributionCounts): number {
	return VOTE_DISTRIBUTION_VALUES.reduce<number>((total, value) => total + counts[value], 0)
}

function parseVoteValue(value: unknown): VoteDistributionValue | null {
	const parsed =
		typeof value === 'number'
			? value
			: typeof value === 'string' && /^-?\d+$/.test(value)
				? Number(value)
				: Number.NaN
	return VOTE_DISTRIBUTION_VALUES.includes(parsed as VoteDistributionValue)
		? (parsed as VoteDistributionValue)
		: null
}

function parseInteger(value: unknown): bigint | null {
	if (typeof value === 'bigint') return value
	if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value)
	if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
	return null
}
