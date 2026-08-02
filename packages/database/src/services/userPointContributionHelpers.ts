export function sortedUniqueUserIds(idUsers: readonly number[]): number[] {
	return [...new Set(idUsers)].toSorted((left, right) => left - right)
}
