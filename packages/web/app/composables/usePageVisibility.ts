import { useDocumentVisibility } from '@vueuse/core'
import { computed } from 'vue'

export function usePageVisibility() {
	const visibility = useDocumentVisibility()

	return computed(() => import.meta.client && visibility.value === 'visible')
}
