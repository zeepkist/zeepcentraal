export type SetFavouriteState = (favourited: boolean, pending: boolean) => void

export async function runOptimisticFavouriteToggle(
	current: boolean,
	setState: SetFavouriteState,
	mutate: () => Promise<unknown>,
) {
	setState(!current, true)
	try {
		await mutate()
		setState(!current, false)
	} catch (error) {
		setState(current, false)
		throw error
	}
}
