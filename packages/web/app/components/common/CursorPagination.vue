<template>
	<nav
		class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3"
		:aria-label="label"
	>
		<div class="flex items-center gap-2 justify-self-start">
			<UButton
				color="neutral"
				variant="soft"
				:disabled="mounted && (!canGoPrevious || pending)"
				@click="first"
			>
				<TablerIcon name="chevrons-left" class="size-4" />
				{{ firstLabel }}
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:disabled="mounted && (!canGoPrevious || pending)"
				@click="previous"
			>
				<TablerIcon name="chevron-left" class="size-4" />
				{{ previousLabel }}
			</UButton>
		</div>
		<div class="grid min-w-6 place-items-center justify-self-center">
			<div
				v-if="pending"
				class="text-primary"
				role="status"
				:aria-label="loadingLabel"
				aria-live="polite"
			>
				<TablerIcon name="loader-2" class="size-5 motion-safe:animate-spin" />
			</div>
		</div>
		<div class="flex items-center gap-2 justify-self-end">
			<UButton
				color="neutral"
				variant="soft"
				:disabled="mounted && (!canGoNext || pending)"
				@click="next"
			>
				{{ nextLabel }}
				<TablerIcon name="chevron-right" class="size-4" />
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:disabled="mounted && (!canGoNext || pending)"
				@click="last"
			>
				{{ lastLabel }}
				<TablerIcon name="chevrons-right" class="size-4" />
			</UButton>
		</div>
	</nav>
</template>

<script setup vapor lang="ts">
import type { CursorPage } from '~/types/app'

const props = defineProps<{
	page: CursorPage
	canGoPrevious: boolean
	canGoNext: boolean
	pending?: boolean
	label: string
	loadingLabel: string
	firstLabel: string
	previousLabel: string
	nextLabel: string
	lastLabel: string
}>()

const emit = defineEmits<{ first: []; previous: []; next: []; last: [] }>()
const mounted = ref(false)

onMounted(() => {
	mounted.value = true
})

function first() {
	if (props.canGoPrevious && !props.pending) emit('first')
}

function previous() {
	if (props.canGoPrevious && !props.pending) emit('previous')
}

function next() {
	if (props.canGoNext && !props.pending) emit('next')
}

function last() {
	if (props.canGoNext && !props.pending) emit('last')
}
</script>
