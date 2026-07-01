export function addTransition(
	active: boolean | undefined,
	wasActive: boolean | undefined,
	count: number,
): number {
	return active && !wasActive ? count + 1 : count
}
