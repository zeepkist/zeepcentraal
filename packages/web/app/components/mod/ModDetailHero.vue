<template>
	<section
		class="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-br from-primary/12 via-card to-card p-5 sm:p-7"
	>
		<div class="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
		<div class="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-center">
			<div class="min-w-0">
				<div class="flex flex-wrap gap-2">
					<UBadge v-for="tag in mod.tags" :key="tag" color="primary" variant="soft">
						{{ tag }}
					</UBadge>
				</div>
				<h1 class="mt-4 text-3xl font-black text-highlighted sm:text-5xl">{{ mod.name }}</h1>
				<p class="mt-2 text-base text-muted-foreground">
					<template v-if="mod.authorUrl">
						<NuxtLink
							:to="mod.authorUrl"
							external
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium text-primary hover:underline"
						>
							{{ byLabel }}
						</NuxtLink>
					</template>
					<span v-else>{{ byLabel }}</span>
				</p>
				<p class="mt-5 max-w-3xl text-lg leading-relaxed text-muted-foreground">{{ mod.summary }}</p>
				<div class="mt-6 flex flex-wrap items-center gap-3">
					<UButton
						:to="mod.profileUrl"
						target="_blank"
						rel="noopener noreferrer"
						color="primary"
						icon="i-tabler-external-link"
					>
						{{ labels.openModio }}
					</UButton>
					<span class="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<TablerIcon name="calendar" class="size-4" />
						{{ labels.published }} <NuxtTime :datetime="mod.dateLive" relative />
					</span>
					<span class="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<TablerIcon name="clock" class="size-4" />
						{{ labels.updated }} <NuxtTime :datetime="mod.dateUpdated" relative />
					</span>
				</div>
				<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div v-for="metric in metrics" :key="metric.label" class="rounded-xl border border-border bg-muted/45 p-3">
						<p class="text-xs text-muted-foreground">{{ metric.label }}</p>
						<p class="mt-1 font-bold tabular-nums text-highlighted">{{ metric.value }}</p>
					</div>
				</div>
			</div>
			<div class="aspect-video overflow-hidden rounded-xl border border-border bg-muted shadow-xl shadow-black/10">
				<NuxtImg
					v-if="mod.imageUrl"
					:src="mod.imageUrl"
					:alt="mod.name"
					class="size-full object-cover"
					loading="eager"
					preload
				/>
				<div v-else class="grid size-full place-items-center">
					<TablerIcon name="photo-off" class="size-12 text-muted-foreground" />
				</div>
			</div>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { ModDetail } from '~/types/mod'

const props = defineProps<{
	mod: ModDetail
	byLabel: string
	labels: {
		version: string
		size: string
		downloads: string
		subscribers: string
		published: string
		updated: string
		openModio: string
		unavailable: string
	}
}>()

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const sizeFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }),
)
const metrics = computed(() => [
	{ label: props.labels.version, value: props.mod.version ?? props.labels.unavailable },
	{
		label: props.labels.size,
		value: props.mod.fileSize == null
			? props.labels.unavailable
			: sizeFormat.value.format(props.mod.fileSize / 1_000_000),
	},
	{ label: props.labels.downloads, value: numberFormat.value.format(props.mod.downloads) },
	{ label: props.labels.subscribers, value: numberFormat.value.format(props.mod.subscribers) },
])
</script>
