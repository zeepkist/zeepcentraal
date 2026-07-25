<template>
	<UCard
		class="rounded-xl border bg-card/70"
		:class="color === 'success' ? 'border-success/35' : 'border-warning/35'"
	>
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-lg font-bold text-highlighted">{{ title }}</h2>
					<UBadge v-if="release" :color="color" variant="soft">
						{{ release.tagName }}
					</UBadge>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
			</div>
			<NuxtTime
				v-if="release"
				:datetime="release.publishedAt"
				relative
				class="text-xs text-muted-foreground"
			/>
		</div>
		<div class="mt-5 grid gap-2 sm:grid-cols-2">
			<UButton
				v-for="format in visibleFormats"
				:key="format"
				:to="`/api/downloads/modkist/${channel}/${format}`"
				target="_blank"
				rel="noopener noreferrer"
				:color="format === 'msi' ? color : 'neutral'"
				:variant="format === 'msi' ? 'solid' : 'soft'"
				block
			>
				<TablerIcon name="download" class="size-4" />
				<span class="truncate">{{ $t(`wikiContent.modkist.formats.${format}`) }}</span>
				<span v-if="release?.assets[format]" class="ml-auto text-xs opacity-70">
					{{ formatSize(release.assets[format].size) }}
				</span>
			</UButton>
		</div>
	</UCard>
</template>

<script setup vapor lang="ts">
import type { ModkistRelease, ModkistReleaseChannel } from '~/types/modkist'

const props = defineProps<{
	channel: ModkistReleaseChannel
	color: 'success' | 'warning'
	description: string
	release: ModkistRelease | null
	title: string
}>()

const { locale } = useI18n()
const formats = ['msi', 'appimage', 'deb', 'dmg'] as const
const visibleFormats = computed(() =>
	props.release ? formats.filter((format) => props.release?.assets[format]) : formats,
)
const sizeFormat = computed(
	() =>
		new Intl.NumberFormat(locale.value, {
			style: 'unit',
			unit: 'megabyte',
			maximumFractionDigits: 1,
		}),
)

function formatSize(bytes: number) {
	return sizeFormat.value.format(bytes / 1_000_000)
}
</script>
