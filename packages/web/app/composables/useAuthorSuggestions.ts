import { useQuery } from '@urql/vue'
import { Zc_UserSuggestionsDocument } from '@zeepkist/graphql/generated'
import type { Ref } from 'vue'
import type { SortOption } from '~/types/app'

export function useAuthorSuggestions(author: Ref<string>) {
	const debouncedAuthor = shallowRef('')
	watch(
		author,
		(value, _, onCleanup) => {
			if (import.meta.server) return
			const timer = setTimeout(() => {
				debouncedAuthor.value = value.trim()
			}, 250)
			onCleanup(() => clearTimeout(timer))
		},
		{ immediate: true },
	)
	const result = useQuery({
		query: Zc_UserSuggestionsDocument,
		variables: computed(() => ({ search: debouncedAuthor.value })),
		pause: computed(() => import.meta.server || debouncedAuthor.value.length < 2),
	})
	const suggestions = computed<SortOption[]>(() =>
		(result.data.value?.users?.nodes ?? []).flatMap((user) =>
			user.steamName ? [{ label: user.steamName, value: String(user.steamId) }] : [],
		),
	)
	return { suggestions, pending: result.fetching }
}
