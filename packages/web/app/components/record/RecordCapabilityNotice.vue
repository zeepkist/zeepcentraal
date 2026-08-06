<template>
	<UAlert
		v-if="unavailableFeatures.length > 0"
		color="warning"
		variant="subtle"
		:icon="icon"
		:title="labels.title"
		:description="labels.description(version)"
		class="rounded-2xl border border-warning/25"
	>
		<template #actions>
			<ul class="mt-2 flex flex-wrap gap-2" :aria-label="labels.featuresLabel">
				<li v-for="feature in features" :key="feature.key">
					<UBadge
						:color="feature.available ? 'success' : 'neutral'"
						:variant="feature.available ? 'soft' : 'subtle'"
						size="sm"
					>
						<TablerIcon
							:name="feature.available ? 'check' : 'minus'"
							class="mr-1 size-3.5"
						/>
						{{ feature.label }}
					</UBadge>
				</li>
			</ul>
		</template>
	</UAlert>
</template>

<script setup vapor lang="ts">
export type RecordCapabilityFeature = {
	key: string
	label: string
	available: boolean
}

import type { GhostPlaybackCapabilities } from '~/types/ghost'
import type { RecordCapabilityLabels } from '~/utils/recordAnalysisLabels'

const props = defineProps<{
	version: number
	capabilities: GhostPlaybackCapabilities
	labels: RecordCapabilityLabels
}>()

const icon = 'i-tabler-alert-triangle'
const features = computed<RecordCapabilityFeature[]>(() =>
	Object.entries(props.capabilities).map(([key, available]) => ({
		key,
		label: props.labels.features[key] ?? '',
		available,
	})),
)
const unavailableFeatures = computed(() => features.value.filter((feature) => !feature.available))
</script>
