<template>
	<nav
		class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3"
		:class="{ '@max-[30rem]/playlist-results:grid-cols-[auto_minmax(0,1fr)_auto]': containerResponsive }"
		:aria-label="label"
	>
		<div class="flex items-center gap-2 justify-self-start">
			<UButton
				color="neutral"
				variant="soft"
				:class="responsiveButtonClass"
				:aria-label="containerResponsive ? firstLabel : undefined"
				:disabled="mounted && (!canGoPrevious || pending)"
				@click="first"
			>
				<TablerIcon name="chevrons-left" class="size-4" />
				<span v-if="containerResponsive" class="hidden @min-[30rem]/playlist-results:inline">{{ firstLabel }}</span>
				<template v-else>{{ firstLabel }}</template>
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:class="responsiveButtonClass"
				:aria-label="containerResponsive ? previousLabel : undefined"
				:disabled="mounted && (!canGoPrevious || pending)"
				@click="previous"
			>
				<TablerIcon name="chevron-left" class="size-4" />
				<span v-if="containerResponsive" class="hidden @min-[30rem]/playlist-results:inline">{{ previousLabel }}</span>
				<template v-else>{{ previousLabel }}</template>
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
				:class="responsiveButtonClass"
				:aria-label="containerResponsive ? nextLabel : undefined"
				:disabled="mounted && (!canGoNext || pending)"
				@click="next"
			>
				<span v-if="containerResponsive" class="hidden @min-[30rem]/playlist-results:inline">{{ nextLabel }}</span>
				<template v-else>{{ nextLabel }}</template>
				<TablerIcon name="chevron-right" class="size-4" />
			</UButton>
			<UButton
				color="neutral"
				variant="soft"
				:class="responsiveButtonClass"
				:aria-label="containerResponsive ? lastLabel : undefined"
				:disabled="mounted && (!canGoNext || pending)"
				@click="last"
			>
				<span v-if="containerResponsive" class="hidden @min-[30rem]/playlist-results:inline">{{ lastLabel }}</span>
				<template v-else>{{ lastLabel }}</template>
				<TablerIcon name="chevrons-right" class="size-4" />
			</UButton>
		</div>
	</nav>
</template>

<script setup lang="ts">
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
	containerResponsive?: boolean
}>()

const emit = defineEmits<{ first: []; previous: []; next: []; last: [] }>()
const mounted = ref(false)
const responsiveButtonClass = computed(() =>
	props.containerResponsive
		? 'min-h-11 justify-center @max-[30rem]/playlist-results:w-11 @max-[30rem]/playlist-results:px-0'
		: undefined,
)

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
