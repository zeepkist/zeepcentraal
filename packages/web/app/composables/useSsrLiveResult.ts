import type { Ref } from 'vue'

export function useSsrLiveResult<T>(seed: Ref<T | undefined>, live: Ref<T | undefined>) {
	const hydrated = ref(false)
	const value = computed(() =>
		hydrated.value && live.value !== undefined ? live.value : seed.value,
	)

	onMounted(() => {
		hydrated.value = true
	})
	return { hydrated: readonly(hydrated), value }
}
