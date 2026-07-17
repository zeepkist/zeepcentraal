import { useQuery } from '@urql/vue'
import { Zc_OmniSearchDocument } from '~/graphql/generated/graphql'
import type { OmniSearchLevelResult, OmniSearchResult, OmniSearchUserResult } from '~/types/app'
import {
	OMNI_SEARCH_DEBOUNCE_MS,
	OMNI_SEARCH_MINIMUM_LENGTH,
	sortOmniSearchLevels,
	sortOmniSearchUsers,
} from '~/utils/omniSearch'

export function useOmniSearch() {
	const { locale } = useI18n()
	const search = ref('')
	const debouncedSearch = ref('')
	let debounceTimer: ReturnType<typeof setTimeout> | undefined

	watch(
		search,
		(value) => {
			if (debounceTimer) clearTimeout(debounceTimer)
			if (import.meta.server) return
			const normalized = value.trim()
			if (normalized.length < OMNI_SEARCH_MINIMUM_LENGTH) {
				debouncedSearch.value = ''
				return
			}
			debounceTimer = setTimeout(() => {
				debouncedSearch.value = normalized
			}, OMNI_SEARCH_DEBOUNCE_MS)
		},
		{ immediate: true },
	)

	onScopeDispose(() => {
		if (debounceTimer) clearTimeout(debounceTimer)
	})

	const result = useQuery({
		query: Zc_OmniSearchDocument,
		variables: computed(() => ({ search: debouncedSearch.value })),
		pause: computed(
			() => import.meta.server || debouncedSearch.value.length < OMNI_SEARCH_MINIMUM_LENGTH,
		),
	})

	const users = computed<OmniSearchUserResult[]>(() => {
		const ranked = (result.data.value?.rankedUsers?.nodes ?? []).flatMap((user) =>
			user.steamName
				? [
						{
							kind: 'user' as const,
							id: user.id,
							steamId: String(user.steamId),
							name: user.steamName,
							rank: user.userPoints?.rank ?? null,
						},
					]
				: [],
		)
		const unranked = (result.data.value?.unrankedUsers?.nodes ?? []).flatMap((user) =>
			user.steamName
				? [
						{
							kind: 'user' as const,
							id: user.id,
							steamId: String(user.steamId),
							name: user.steamName,
							rank: null,
						},
					]
				: [],
		)
		return sortOmniSearchUsers(ranked, unranked, locale.value)
	})

	const levels = computed<OmniSearchLevelResult[]>(() =>
		sortOmniSearchLevels(
			(result.data.value?.levels?.nodes ?? []).map((level) => {
				const item = level.levelItems.nodes[0]
				return {
					kind: 'level' as const,
					id: level.id,
					xxHash: level.xxHash,
					name: item?.name ?? level.xxHash,
					authorName: item?.author?.steamName ?? null,
					imageUrl: item?.imageUrl ?? null,
					points: level.levelPoints?.points ?? null,
					rating: level.levelPoints?.rating ?? null,
					voteCount: level.votes.totalCount,
				}
			}),
			locale.value,
		),
	)

	async function select(item: OmniSearchResult) {
		search.value = ''
		debouncedSearch.value = ''
		await navigateTo(item.kind === 'user' ? `/user/${item.steamId}` : `/level/${item.xxHash}`)
	}

	return {
		error: result.error,
		levels,
		pending: result.fetching,
		search,
		select,
		users,
	}
}
