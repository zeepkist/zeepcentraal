<template>
	<section :aria-label="labels.label">
		<UTabs
			v-model="activeTab"
			:items="items"
			:aria-label="labels.label"
			color="primary"
			variant="pill"
			class="w-full"
			:ui="{
				list: 'w-full flex-wrap justify-start rounded-xl border border-border bg-card/60 p-1.5',
				content: 'pt-6 outline-none',
			}"
		>
			<template #telemetry>
				<div v-if="activeTab === 'telemetry'" class="space-y-8">
					<slot name="telemetry" />
				</div>
			</template>
			<template #charts>
				<div v-if="activeTab === 'charts'" class="space-y-8"><slot name="charts" /></div>
			</template>
			<template #analysis>
				<div v-if="activeTab === 'analysis'" class="space-y-8">
					<slot name="analysis" />
				</div>
			</template>
			<template #improvement>
				<div v-if="activeTab === 'improvement'" class="space-y-8">
					<slot name="improvement" />
				</div>
			</template>
		</UTabs>
	</section>
</template>

<script setup vapor lang="ts">
const props = defineProps<{
	labels: {
		label: string
		telemetry: string
		charts: string
		analysis: string
		improvement: string
	}
}>()

type RecordAnalysisTab = 'telemetry' | 'charts' | 'analysis' | 'improvement'

const activeTab = defineModel<RecordAnalysisTab>({ default: 'telemetry' })
const items = computed(() => [
	{ label: props.labels.telemetry, slot: 'telemetry' as const, value: 'telemetry' as const },
	{ label: props.labels.charts, slot: 'charts' as const, value: 'charts' as const },
	{ label: props.labels.analysis, slot: 'analysis' as const, value: 'analysis' as const },
	{
		label: props.labels.improvement,
		slot: 'improvement' as const,
		value: 'improvement' as const,
	},
])
</script>
