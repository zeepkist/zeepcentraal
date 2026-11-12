<script setup lang="ts">
import type { DashboardChartEntry } from '~/types/app'
import { MEDALS, type MedalCounts } from '~/utils/medals'

const props = defineProps<{ counts: MedalCounts }>()
const { t, locale } = useAppI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const total = computed(() => Object.values(props.counts).reduce((sum, value) => sum + value, 0))
const entries = computed<DashboardChartEntry[]>(() => [
	...MEDALS.map(medal => ({ key: medal.key, label: t(medal.labelKey), value: props.counts[medal.key], formattedValue: number.value.format(props.counts[medal.key]), color: medal.color, image: medal.src })),
	{ key: 'none', label: t('medals.none'), value: props.counts.none, formattedValue: number.value.format(props.counts.none), color: '#64748b' },
])
</script>

<template>
	<section aria-labelledby="profile-medals">
		<SectionHeader id="profile-medals" :title="t('medals.distribution')" :description="t('medals.description')" />
		<DashboardDonutChart v-if="total > 0" :entries="entries" :total-label="number.format(total)" :ariaLabel="t('medals.distribution')" />
		<p v-else class="py-6 text-muted-foreground">{{ t('medals.empty') }}</p>
	</section>
</template>
