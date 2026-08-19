import type { LevelSummary } from '~/types/app'
import { runOptimisticFavouriteToggle } from '~/utils/favouriteState'

type FavouriteEntry = {
	favourited: boolean
	pending: boolean
	dirty: boolean
}

type FavouriteEntries = Record<string, FavouriteEntry>

type FavouriteTarget = Pick<LevelSummary, 'favourited' | 'id' | 'xxHash'> & {
	userId: number
}

type FavouriteRequest = (
	endpoint: string,
	options: { method: 'DELETE' | 'PUT'; credentials: 'include' },
) => Promise<unknown>

function entryKey(userId: number, levelId: number) {
	return `${userId}:${levelId}`
}

export function useLevelFavouriteState() {
	const entries = useState<FavouriteEntries>('level-favourite-entries', () => ({}))
	const revision = useState('level-favourite-revision', () => 0)

	function initialize(target: FavouriteTarget) {
		const key = entryKey(target.userId, target.id)
		const current = entries.value[key]
		if (current?.dirty || current?.pending) return
		entries.value[key] = {
			favourited: target.favourited,
			pending: false,
			dirty: false,
		}
	}

	function isFavourited(target: FavouriteTarget) {
		return entries.value[entryKey(target.userId, target.id)]?.favourited ?? target.favourited
	}

	function isPending(target: FavouriteTarget) {
		return entries.value[entryKey(target.userId, target.id)]?.pending ?? false
	}

	async function toggle(target: FavouriteTarget) {
		initialize(target)
		const key = entryKey(target.userId, target.id)
		const current = entries.value[key]
		if (!current || current.pending) return

		const previous = current.favourited
		const endpoint: string = `/api/favourite/${encodeURIComponent(target.xxHash)}`
		const request = $fetch as unknown as FavouriteRequest
		await runOptimisticFavouriteToggle(
			previous,
			(favourited, pending) => {
				entries.value[key] = { favourited, pending, dirty: true }
			},
			() =>
				request(endpoint, {
					method: previous ? 'DELETE' : 'PUT',
					credentials: 'include',
				}),
		)
		revision.value += 1
	}

	return {
		initialize,
		isFavourited,
		isPending,
		revision: readonly(revision),
		toggle,
	}
}
