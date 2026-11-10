<script setup lang="ts">
import { CartesianGrid, Line, ResponsiveContainer, LineChart as TimeLineChart, Tooltip, XAxis, YAxis } from 'vccs'
import { h } from 'vue'
import { DashboardChartTooltip } from '#components'
import type { LobbyChartPoint } from '~/utils/lobbyAnalytics'

const props = defineProps<{ title: string; points: LobbyChartPoint[]; series: Array<{ key: string; label: string; color: string }>; step?: boolean }>()
const { t, locale } = useAppI18n()
const hidden = shallowRef<string[]>([])
const mounted = shallowRef(false)
onMounted(() => { mounted.value = true })
const active = computed(() => props.series.filter(series => !hidden.value.includes(series.key)))
const keys = computed(() => active.value.map(series => series.key))
const margin = { top: 10, right: 20, bottom: 15, left: 0 }
const timeDomain: ['dataMin', 'dataMax'] = ['dataMin', 'dataMax']
const axisTick = { fill: 'currentColor', fontSize: 11 }
const stepDot = { r: 1.5 }
const timeFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'medium', ...(!mounted.value ? { timeZone: 'UTC' } : {}) }))
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const axisNumberFormatter = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const formatTime = (time: number) => timeFormatter.value.format(new Date(time))
const formatNumber = (value: number) => axisNumberFormatter.value.format(value)
function toggle(key: string) { hidden.value = hidden.value.includes(key) ? hidden.value.filter(item => item !== key) : [...hidden.value,key] }
function tooltip(values: unknown) {
	const row = values as LobbyChartPoint | undefined
	return active.value.flatMap(series => typeof row?.[series.key] === 'number' ? [{ key: series.key, label: series.label, value: row[series.key] as number, formattedValue: numberFormatter.value.format(row[series.key] as number), color: series.color }] : [])
}
function tooltipTime(values: unknown) { const time = (values as LobbyChartPoint | undefined)?.time; return typeof time === 'number' ? formatTime(time) : '' }
function renderTooltip(value: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
	if (!value.active) return null
	const row=value.payload?.[0]?.payload
	const entries = tooltip(row)
	if (!entries.length) return null
	return h(DashboardChartTooltip,{ entries,title:tooltipTime(row),showPercentage:false })
}
</script>

<template>
	<UCard class="lobby-chart min-w-0">
		<h2 class="mb-4 font-semibold">{{ title }}</h2>
		<fieldset class="mb-4 flex flex-wrap gap-2" :aria-label="title">
			<button v-for="series in series" :key="series.key" type="button" :disabled="!mounted" class="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary" :aria-pressed="!hidden.includes(series.key)" :class="hidden.includes(series.key) ? 'opacity-50' : 'bg-primary/10'" @click="toggle(series.key)"><span aria-hidden="true" class="h-0.5 w-3 rounded" :style="{backgroundColor:series.color}" />{{ series.label }}</button>
		</fieldset>
		<ClientOnly>
			<div v-if="points.length && keys.length" class="h-64 w-full text-xs text-muted-foreground" role="img" :aria-label="title">
				<ResponsiveContainer width="100%" :height="260"><TimeLineChart :data="points" :margin="margin">
					<CartesianGrid stroke="currentColor" :stroke-opacity="0.12" :vertical="false" />
					<XAxis data-key="time" type="number" scale="time" :domain="timeDomain" :tick-formatter="formatTime" :tick-count="4" :tick="axisTick" :min-tick-gap="35" />
					<YAxis :tick="axisTick" :tick-formatter="formatNumber" />
					<Tooltip :content="renderTooltip" :is-animation-active="false" />
					<Line v-for="series in active" :key="series.key" :data-key="series.key" :name="series.label" :stroke="series.color" :stroke-width="2" :type="step ? 'stepAfter' : 'linear'" :connect-nulls="false" :dot="step ? stepDot : points.length === 1" :is-animation-active="false">
						<template #shape="shape"><LobbyChartLineShape :points="shape.points" :stroke="series.color" :step="step" /></template>
					</Line>
				</TimeLineChart></ResponsiveContainer>
			</div>
			<p v-else class="py-12 text-center text-muted-foreground">{{ t('lobby.analytics.noObservations') }}</p>
			<template #fallback><USkeleton class="h-64 w-full" /></template>
		</ClientOnly>
	</UCard>
</template>

<style scoped>
.lobby-chart {
	--vc-grid-color: var(--border);
	--vc-tick-color: var(--muted-foreground);
	--vc-legend-color: var(--foreground);
	--vc-tooltip-fg: var(--foreground);
}
</style>
