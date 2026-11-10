import { useIntervalFn } from '@vueuse/core'
import { type MaybeRefOrGetter, shallowRef, toValue, watch } from 'vue'

/** Local display clock only; no network requests. VueUse disposes its timer with the scope. */
export function useLobbyClock(enabled: MaybeRefOrGetter<boolean> = true) {
	const visible = usePageVisibility()
	const now = shallowRef(new Date())
	const { pause, resume } = useIntervalFn(
		() => {
			now.value = new Date()
		},
		60_000,
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
