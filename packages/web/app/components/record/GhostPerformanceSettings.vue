<template>
	<UPopover>
		<UButton
			color="neutral"
			variant="soft"
			icon="i-tabler-adjustments-horizontal"
			:aria-label="labels.open"
		/>
		<template #content>
			<div class="w-80 space-y-5 p-4">
				<div>
					<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
					<p class="mt-1 text-xs text-muted">{{ labels.description }}</p>
				</div>
				<UFormField :label="labels.frameRate">
					<USelect
						:model-value="preferences.frameRate"
						:items="frameRateItems"
						class="w-full"
						@update:model-value="$emit('update:frameRate', $event as GhostFrameRate)"
					/>
				</UFormField>
				<UFormField :label="labels.quality">
					<USelect
						:model-value="preferences.renderQuality"
						:items="qualityItems"
						class="w-full"
						@update:model-value="$emit('update:renderQuality', $event as GhostRenderQuality)"
					/>
				</UFormField>
				<div class="rounded-xl border border-border bg-muted/40 p-3">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-sm font-semibold text-highlighted">{{ labels.cache }}</p>
							<p class="mt-0.5 text-xs text-muted">
								{{ cacheLabel }}
							</p>
						</div>
						<UButton
							color="neutral"
							variant="ghost"
							size="sm"
							icon="i-tabler-trash"
							:loading="cachePending"
							:disabled="!cacheStats?.entryCount"
							@click="$emit('clearCache')"
						>
							{{ labels.clearCache }}
						</UButton>
					</div>
				</div>
			</div>
		</template>
	</UPopover>
</template>

<script setup lang="ts">
import type {
	GhostFrameRate,
	GhostPerformancePreferences,
	GhostRenderQuality,
} from '~/types/ghost'
import type { GhostBinaryCacheStats } from '~/utils/ghostBinaryCache.client'

const props = defineProps<{
	preferences: GhostPerformancePreferences
	cacheStats: GhostBinaryCacheStats | null
	cachePending: boolean
	labels: {
		open: string
		title: string
		description: string
		frameRate: string
		quality: string
		auto: string
		fps30: string
		fps60: string
		performance: string
		balanced: string
		qualityHigh: string
		cache: string
		cacheValue: (entries: string, size: string) => string
		clearCache: string
		unavailable: string
	}
}>()

defineEmits<{
	'update:frameRate': [value: GhostFrameRate]
	'update:renderQuality': [value: GhostRenderQuality]
	clearCache: []
}>()

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const bytes = computed(
	() =>
		new Intl.NumberFormat(locale.value, {
			style: 'unit',
			unit: 'megabyte',
			maximumFractionDigits: 1,
		}),
)
const frameRateItems = computed(() => [
	{ label: props.labels.auto, value: 'auto' },
	{ label: props.labels.fps30, value: 30 },
	{ label: props.labels.fps60, value: 60 },
])
const qualityItems = computed(() => [
	{ label: props.labels.auto, value: 'auto' },
	{ label: props.labels.performance, value: 'performance' },
	{ label: props.labels.balanced, value: 'balanced' },
	{ label: props.labels.qualityHigh, value: 'quality' },
])
const cacheLabel = computed(() => {
	const stats = props.cacheStats
	if (!stats) return props.labels.unavailable
	return props.labels.cacheValue(
		number.value.format(stats.entryCount),
		bytes.value.format(stats.totalBytes / 1_000_000),
	)
})
</script>
