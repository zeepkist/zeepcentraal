<template>
	<div class="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card to-primary/5">
		<div v-if="resolvedInsights.length > 0" class="grid gap-3 p-4 lg:grid-cols-2">
			<button
				v-for="insight in resolvedInsights"
				:key="insight.id"
				type="button"
				:disabled="insight.time === null"
				class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border p-3 text-left"
				:class="[
					toneClasses[insight.tone],
					insight.time === null
						? ''
						: 'group transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
				]"
				@click="insight.time === null ? undefined : emit('seek', insight.time)"
			>
				<span class="grid size-9 place-items-center rounded-lg bg-muted/50">
					<TablerIcon :name="insight.icon" class="size-5" />
				</span>
				<span class="min-w-0">
					<span class="block text-sm font-bold text-highlighted">{{ insight.title }}</span>
					<span class="mt-1 block text-xs leading-relaxed text-muted-foreground">
						{{ insight.description }}
					</span>
					<span
						v-if="insight.metric"
						class="mt-2 inline-flex rounded-md bg-muted/60 px-2 py-1 text-xs font-semibold tabular-nums text-highlighted"
					>
						{{ insight.metric }}
					</span>
				</span>
				<TablerIcon
					v-if="insight.time !== null"
					name="player-play"
					class="mt-1 size-4 text-muted-foreground transition-colors group-hover:text-primary"
				/>
			</button>
		</div>

		<div v-else class="grid min-h-40 place-items-center px-6 text-center text-sm text-muted-foreground">
			{{ labels.emptyLabel }}
		</div>
	</div>
</template>

<script setup lang="ts">
import type { RecordAnalysisLabels } from '~/utils/recordAnalysisLabels'
import type { RecordCoachingSignal } from '~/utils/recordGhostAnalysis'

type RecordCoachingInsight = {
	id: string
	tone: 'positive' | 'warning' | 'info'
	icon: string
	title: string
	description: string
	metric?: string | null
	time: number | null
}

const props = defineProps<{
	insights: RecordCoachingSignal[]
	labels: RecordAnalysisLabels['coaching']
}>()

const emit = defineEmits<{ seek: [time: number] }>()
const { locale } = useI18n()
const decimalFormat = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
)
const percentageFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)
const toneClasses = {
	positive: 'border-success/30 bg-success/5 text-success',
	warning: 'border-warning/30 bg-warning/5 text-warning',
	info: 'border-info/30 bg-info/5 text-info',
} as const
const resolvedInsights = computed<RecordCoachingInsight[]>(() =>
	props.insights.map((signal) => {
		const config = props.labels.insights[signal.kind]
		const value = formatSignalValue(signal)
		return {
			id: signal.id,
			tone: signal.tone,
			icon: config.icon,
			title: config.title,
			description: config.description(value),
			metric: value,
			time: signal.start,
		}
	}),
)

function formatSignalValue(signal: RecordCoachingSignal) {
	if (signal.kind === 'strong-speed-retention' || signal.kind === 'drift-speed-loss') {
		return percentageFormat.value.format(signal.value)
	}
	if (signal.kind === 'long-drift' || signal.kind === 'low-input-section') {
		return `${decimalFormat.value.format(signal.value)} ${props.labels.secondsUnit}`
	}
	if (signal.kind === 'late-braking' || signal.kind === 'comparison-speed-deficit') {
		return `${decimalFormat.value.format(signal.value)} ${props.labels.speedUnit}`
	}
	return props.labels.unavailableLabel
}
</script>
