import { useIntervalFn } from '@vueuse/core'
import { computed, type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue'

/** Local display clock only; no network requests. VueUse disposes its timer with the scope. */
export function useLobbyClock(
	enabled: MaybeRefOrGetter<boolean> = true,
	latestOpenStart?: MaybeRefOrGetter<number | undefined>,
) {
	const visible = usePageVisibility()
	const now = shallowRef(new Date())
	const interval = computed(() => {
		const start = toValue(latestOpenStart)
		return start != null && now.value.getTime() - start < 60_000 ? 1000 : 60_000
	})
	const { pause, resume } = useIntervalFn(
		() => {
			now.value = new Date()
		},
		interval,
		{
			immediate: false,
		},
	)
	watch(
		() => visible.value && toValue(enabled),
		(active) => {
			if (active) {
				now.value = new Date()
				resume()
			} else pause()
		},
		{ immediate: true },
	)
	return now
}
