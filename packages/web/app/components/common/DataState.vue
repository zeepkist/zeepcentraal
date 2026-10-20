<script setup vapor lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import { cssTimeToMilliseconds } from '~/utils/motion'

const props = withDefaults(
	defineProps<{
		pending?: boolean
		error?: string | null
		empty?: boolean
		initialReveal?: boolean
		loadingLabel: string
		errorTitle: string
		emptyTitle: string
		skeletons?: number
	}>(),
	{ pending: false, error: null, empty: false, initialReveal: false, skeletons: 3 },
)

const content = useTemplateRef<HTMLElement>('content')
const preferredMotion = usePreferredReducedMotion()
let mounted = false
let armed = false
let consumed = false
let reveal: Animation | undefined
let generation = 0

function cancelReveal() {
	generation++
	reveal?.cancel()
	reveal = undefined
}

function canReveal() {
	return mounted && props.initialReveal && !props.pending && !props.error && !props.empty
}

async function revealContent() {
	const pendingGeneration = generation
	await nextTick()
	if (pendingGeneration !== generation || !canReveal()) return
	const element = content.value
	if (!element?.animate || !element.getClientRects().length) return
	const bounds = element.getBoundingClientRect()
	if (
		bounds.width <= 0 ||
		bounds.height <= 0 ||
		bounds.bottom <= 0 ||
		bounds.right <= 0 ||
		bounds.top >= window.innerHeight ||
		bounds.left >= window.innerWidth
	) return
	const style = getComputedStyle(element)
	const duration = cssTimeToMilliseconds(style.getPropertyValue('--duration-feedback'))
	const easing = style.getPropertyValue('--ease-out').trim()
	if (!Number.isFinite(duration) || duration <= 0 || !easing) return
	const reduced = preferredMotion.value === 'reduce'
	const animation = element.animate([{ opacity: reduced ? 0.85 : 0 }, { opacity: 1 }], {
		duration,
		easing: reduced ? 'cubic-bezier(0.25, 0.1, 0.25, 1)' : easing,
	})
	reveal = animation
	const clearReveal = () => {
		if (reveal === animation) reveal = undefined
	}
	void animation.finished.then(clearReveal, clearReveal)
}

onMounted(() => {
	mounted = true
	armed = props.initialReveal && props.pending
	consumed = !armed
})

watch(
	[() => props.pending, () => props.error, () => props.empty, () => props.initialReveal],
	() => {
		if (!mounted) return
		if (!props.initialReveal) consumed = true
		if (props.pending || props.error || props.empty || !props.initialReveal) cancelReveal()
		if (!armed || consumed || props.pending) return
		consumed = true
		if (canReveal()) void revealContent()
	},
	{ flush: 'sync' },
)
watch(preferredMotion, cancelReveal, { flush: 'sync' })
onScopeDispose(() => {
	mounted = false
	cancelReveal()
})
</script>

<template>
	<div>
		<div v-if="pending" class="grid gap-3" role="status" :aria-label="loadingLabel">
			<slot name="pending">
				<USkeleton v-for="index in skeletons" :key="index" class="h-20 w-full" />
			</slot>
		</div>
		<UAlert v-else-if="error" color="error" :title="errorTitle" :description="error">
			<template #icon><TablerIcon name="exclamation-circle" /></template>
		</UAlert>
		<div v-else-if="empty" class="grid place-items-center gap-3 rounded-xl border border-border p-8 text-center">
			<TablerIcon name="ghost-2" class="size-8 text-muted-foreground" />
			<p class="font-medium">{{ emptyTitle }}</p>
		</div>
		<div v-else-if="initialReveal" ref="content"><slot /></div>
		<slot v-else />
	</div>
</template>
