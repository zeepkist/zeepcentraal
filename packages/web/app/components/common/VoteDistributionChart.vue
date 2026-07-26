<template>
	<DashboardDonutChart
		v-if="total > 0"
		:entries="entries"
		:total-label="labels.total(total)"
		:ariaLabel="labels.ariaLabel"
		compact
	/>
	<div
		v-else
		class="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/70 bg-default/30 px-4 text-center text-sm font-medium text-muted-foreground"
	>
		{{ labels.empty }}
	</div>
</template>

<script setup vapor lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import {
	VOTE_DISTRIBUTION_VALUES,
	type VoteDistributionCounts,
	voteDistributionTotal,
} from '~/utils/voteDistribution'

const props = defineProps<{
	counts: VoteDistributionCounts
	labels: {
		ariaLabel: string
		empty: string
		total: (count: number) => string
	}
}>()

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const total = computed(() => voteDistributionTotal(props.counts))
const definitions = {
	2: { key: 'strong-positive', label: '++', color: '#16a34a' },
	1: { key: 'positive', label: '+', color: '#86efac' },
	0: { key: 'neutral', label: '+-/-+', color: '#facc15' },
	[-1]: { key: 'negative', label: '-', color: '#fca5a5' },
	[-2]: { key: 'strong-negative', label: '--', color: '#dc2626' },
} as const
const entries = computed<DashboardChartEntry[]>(() =>
	VOTE_DISTRIBUTION_VALUES.map((value) => ({
		key: definitions[value].key,
		label: definitions[value].label,
		value: props.counts[value],
		formattedValue: numberFormat.value.format(props.counts[value]),
		color: definitions[value].color,
	})),
)
</script>
