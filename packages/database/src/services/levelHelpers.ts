/**
 * Adventure status is monotonic. Record submissions may identify an existing Workshop level as
 * Adventure, but later community submissions must never demote a confirmed Adventure level.
 */
export function resolveAdventureStatus(existing: boolean, requested: boolean): boolean {
	return existing || requested
}
