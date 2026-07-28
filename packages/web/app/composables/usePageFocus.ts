import { useDocumentVisibility, useWindowFocus } from '@vueuse/core'
import { computed } from 'vue'

export function usePageFocus() {
	const visibility = useDocumentVisibility()
	const windowFocused = useWindowFocus()

	return computed(
		() => import.meta.client && visibility.value === 'visible' && windowFocused.value,
	)
}
