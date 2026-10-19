import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onMounted, shallowRef } from 'vue'

/** Keep SSR and first render still; track preference changes after mount. */
export function useMotionDuration(duration: number) {
	// VueUse useMounted relies on getCurrentInstance(), which is null in Vapor.
	const mounted = shallowRef(false)
	const preferredMotion = usePreferredReducedMotion()
	onMounted(() => {
		mounted.value = true
	})
	return computed(() => (mounted.value && preferredMotion.value !== 'reduce' ? duration : 0))
}
