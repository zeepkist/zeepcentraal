import { useResizeObserver } from '@vueuse/core'
import type { MaybeRefOrGetter, Ref } from 'vue'

export function useScrollableTabs(
	root: Readonly<Ref<HTMLElement | null>>,
	modelValue: MaybeRefOrGetter<unknown>,
	items: MaybeRefOrGetter<unknown>,
) {
	function revealActiveTab() {
		const list = root.value?.querySelector<HTMLElement>('[role="tablist"]')
		const active = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
		if (!list || !active) return

		const bounds = list.getBoundingClientRect()
		const tab = active.getBoundingClientRect()
		const style = getComputedStyle(list)
		const left = bounds.left + list.clientLeft + Number.parseFloat(style.paddingLeft)
		const right =
			bounds.left + list.clientLeft + list.clientWidth - Number.parseFloat(style.paddingRight)
		const delta = tab.left < left ? tab.left - left : Math.max(0, tab.right - right)
		// Scroll only the tab strip; scrollIntoView can also move the page and panel.
		if (delta) list.scrollBy({ left: delta, behavior: 'instant' })
	}

	onMounted(revealActiveTab)
	watch([root, () => toValue(modelValue), () => toValue(items)], revealActiveTab, {
		flush: 'post',
	})
	useResizeObserver(
		() => root.value?.querySelector<HTMLElement>('[role="tablist"]'),
		revealActiveTab,
	)

	return {
		list: 'w-full max-w-full flex-nowrap justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
		trigger: 'min-h-11 shrink-0 whitespace-nowrap',
		label: 'overflow-visible whitespace-nowrap text-clip',
	}
}
