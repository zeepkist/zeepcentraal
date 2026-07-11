type ViewportObserver = Pick<IntersectionObserver, 'disconnect' | 'observe'>
type ViewportObserverFactory = (
	callback: IntersectionObserverCallback,
	options: IntersectionObserverInit,
) => ViewportObserver

export type ViewportPrefetchOptions = {
	rootMargin?: string
}

export function observeViewportPrefetch(
	target: Element,
	activate: () => void,
	options: ViewportPrefetchOptions = {},
	observerFactory?: ViewportObserverFactory,
) {
	let activated = false
	const activateOnce = () => {
		if (activated) return
		activated = true
		activate()
	}
	const factory =
		observerFactory ??
		(typeof IntersectionObserver === 'undefined'
			? undefined
			: (callback: IntersectionObserverCallback, init: IntersectionObserverInit) =>
					new IntersectionObserver(callback, init))

	if (!factory) {
		activateOnce()
		return () => {}
	}

	const observer = factory(
		(entries) => {
			if (activated || !entries.some((entry) => entry.isIntersecting)) return
			activateOnce()
			observer.disconnect()
		},
		{ rootMargin: options.rootMargin ?? '100% 0px' },
	)
	observer.observe(target)
	return () => observer.disconnect()
}

export function useViewportPrefetch(options: ViewportPrefetchOptions = {}) {
	const target = ref<HTMLElement | null>(null)
	const active = ref(false)
	let disconnect: (() => void) | undefined
	let stopWatching: (() => void) | undefined

	onMounted(() => {
		stopWatching = watch(
			target,
			(element) => {
				disconnect?.()
				disconnect = undefined
				if (!element || active.value) return
				disconnect = observeViewportPrefetch(
					element,
					() => {
						active.value = true
					},
					options,
				)
			},
			{ immediate: true },
		)
	})

	onScopeDispose(() => {
		stopWatching?.()
		disconnect?.()
	})

	return { active: readonly(active), target }
}
