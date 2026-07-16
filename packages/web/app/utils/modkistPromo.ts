export function shouldShowModkistPromo(
	isAuthenticated: boolean,
	recordCount: number | undefined,
): boolean {
	if (!isAuthenticated) return true
	return recordCount === 0
}
