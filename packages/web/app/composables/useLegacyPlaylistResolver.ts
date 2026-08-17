import { useQuery } from '@urql/vue'
import { Zc_PlaylistLevelsByUidDocument } from '@zeepkist/graphql/generated'
import type { LocalPlaylistLevel } from '~/types/app'
import { parseSafeWorkshopId } from '~/utils/playlist'

export function useLegacyPlaylistResolver() {
	const uids = ref<string[]>([])
	const query = useQuery({
		query: Zc_PlaylistLevelsByUidDocument,
		variables: computed(() => ({ uids: uids.value })),
		pause: true,
	})

	async function resolveLegacyLevels(requestedUids: string[]): Promise<LocalPlaylistLevel[]> {
		const results: LocalPlaylistLevel[] = []
		for (let start = 0; start < requestedUids.length; start += 100) {
			uids.value = requestedUids.slice(start, start + 100)
			const result = await query.executeQuery({ requestPolicy: 'network-only' })
			if (result.error.value) throw new Error(result.error.value.message)
			for (const item of result.data.value?.levelItems?.nodes ?? []) {
				const WorkshopID = parseSafeWorkshopId(item.workshopId)
				if (!item.level?.xxHash || WorkshopID === null) continue
				results.push({
					UID: item.fileUid,
					WorkshopID,
					Name: item.name,
					Author: item.fileAuthor || item.author?.steamName || '',
					xxHash: item.level.xxHash,
					imageUrl: item.imageUrl,
				})
			}
		}
		return results
	}

	return resolveLegacyLevels
}
