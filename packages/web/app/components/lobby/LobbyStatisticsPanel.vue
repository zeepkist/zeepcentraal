<script setup lang="ts">
import type { StatisticMetric } from '~/types/app'
import { hasLobbyPeriodCoverage, type LobbyChartPoint, lobbyChange, lobbyRatio, rangeDuration, withLobbyChartGaps } from '~/utils/lobbyAnalytics'
import { lobbyLabel } from '~/utils/lobbyLabels'

const props = defineProps<{ live?: boolean }>()
const { t, locale } = useAppI18n()
const route = useRoute()
const router = useRouter()
const { data, error, fetching, range, peak, anchor } = useLobbyStatistics(props.live)
const { number, mounted } = useLobbyFormat()
// Retain presentation only; operation data remains isolated by variables.
const displayed = computed<typeof data.value>(previous => data.value ?? previous)
const pending = computed(() => fetching.value || (!data.value && !error.value))
const latest = computed(() => displayed.value?.latest?.nodes[0])
if (!props.live) useDiscordComponentEmbed(() => ({
	title: 'Lobby statistics',
	description: latest.value ? `${latest.value.players} online | ${latest.value.playersInRooms} in rooms | ${latest.value.rooms} rooms | Observed ${String(latest.value.dateCreated)}` : undefined,
	links: [{ label: 'Current rooms', url: '/lobby' }, { label: 'Room history', url: '/lobby/history' }],
}))
const cards = computed<StatisticMetric[]>(() => [
	{ key: 'online', label: t('lobby.summary.onlinePlayers'), value: number(latest.value?.players), icon: 'users' },
	{ key: 'rooms', label: t('lobby.summary.playersInLobbies'), value: number(latest.value?.playersInRooms), icon: 'users-group' },
	{ key: 'active', label: t('lobby.summary.lobbies'), value: number(latest.value?.rooms), icon: 'server' },
	{ key: 'outside', label: t('lobby.analytics.outside'), value: number(latest.value ? latest.value.players-latest.value.playersInRooms : null), icon: 'user' },
])
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
const peaks = computed<Array<StatisticMetric & { timestamp?: string | null }>>(() => {
	const online = displayed.value?.onlinePeak?.nodes[0], rooms = displayed.value?.roomsPeak?.nodes[0], participation = displayed.value?.participationPeak?.nodes[0], room = displayed.value?.roomPeak?.nodes[0]
	return [
		{ key: 'online', label: t('lobby.analytics.peakOnline'), value: number(online?.players), timestamp: timestamp(online?.dateCreated) },
		{ key: 'participation', label: t('lobby.analytics.peakInRooms'), value: number(participation?.playersInRooms), timestamp: timestamp(participation?.dateCreated) },
		{ key: 'rooms', label: t('lobby.analytics.peakRooms'), value: number(rooms?.rooms), timestamp: timestamp(rooms?.dateCreated) },
		{ key: 'room', label: t('lobby.analytics.peakSingleRoom'), value: number(room?.peakPlayers), to: room ? `/lobby/${room.id}` : undefined, details: [{ label: t('lobby.analytics.allTime'), value: room?.roomName ?? t('common.unavailable') }], timestamp: timestamp(room?.peakTime) },
	]
})
const averages = computed(() => displayed.value?.period?.aggregates)
const summary = computed<StatisticMetric[]>(() => {
	const value = averages.value, previous = displayed.value?.previous?.aggregates
	const duration = rangeDuration(range.value)
	const enough = range.value !== 'all' && hasLobbyPeriodCoverage(anchor.value-duration,anchor.value,displayed.value?.period?.nodes[0]?.dateCreated,latest.value?.dateCreated) && hasLobbyPeriodCoverage(anchor.value-duration*2,anchor.value-duration,displayed.value?.previous?.nodes[0]?.dateCreated,displayed.value?.previousEnd?.nodes[0]?.dateCreated)
	const participation = lobbyRatio(value?.sum?.playersInRooms,value?.sum?.players)
	const previousParticipation = lobbyRatio(previous?.sum?.playersInRooms,previous?.sum?.players)
	const entries = [
		['averageOnline',value?.average?.players,previous?.average?.players],
		['averageInRooms',value?.average?.playersInRooms,previous?.average?.playersInRooms],
		['averageRooms',value?.average?.rooms,previous?.average?.rooms],
		['peakOnline',value?.max?.players,previous?.max?.players],
		['peakRooms',value?.max?.rooms,previous?.max?.rooms],
		['participation',participation === null ? null : participation*100,previousParticipation === null ? null : previousParticipation*100],
	] as const
	return entries.map(([key,current,before]) => {
		const change = enough ? lobbyChange(current,before) : null
		return { key, label: key === 'participation' ? t('lobby.analytics.participation') : t(lobbyLabel(key)), value: current == null ? t('common.unavailable') : key === 'participation' ? `${number(current)}%` : number(current), details: change === null ? undefined : [{ label: t('lobby.analytics.previousPeriod'),value: `${number(change*100)}%` }] }
	})
})
const points = computed<LobbyChartPoint[]>(() => {
	const rows = (displayed.value?.period?.groupedAggregates ?? []).map(bucket => ({
		time: Date.parse(bucket.keys?.[0] ?? ''),
		onlineMax: bucket.max?.players ?? null, inRoomsMax: bucket.max?.playersInRooms ?? null,
		roomsMax: bucket.max?.rooms ?? null, perRoom: lobbyRatio(bucket.sum?.playersInRooms,bucket.sum?.rooms),
	})).filter(point => Number.isFinite(point.time)).sort((a,b) => a.time-b.time)
	const interval = ({ '24h': 300_000, '7d': 3_600_000, '30d': 21_600_000, '90d': 86_400_000, '1y': 86_400_000, all: 2_764_800_000 })[range.value]
	return withLobbyChartGaps(rows,interval)
})
const series = (key: string, color: string, label = key) => ({ key, color, label: t(lobbyLabel(label)) })
const playerSeries = computed(() => [series('onlineMax','var(--color-chart-2)'),series('inRoomsMax','var(--color-chart-4)')])
const roomSeries = computed(() => [series('roomsMax','var(--color-chart-2)')])
const perRoomSeries = computed(() => [series('perRoom','var(--color-chart-1)','averagePerRoom')])

</script>

<template>
	<div class="space-y-4" :aria-busy="pending">
			<div v-if="live" data-testid="lobby-live-cards" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard v-for="card in cards" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :to="card.to" :icon="card.icon ?? 'dashboard'" /></div>
			<LobbyFreshness :observed-at="latest?.dateCreated" :error="error?.message" />
			<div class="my-4 flex flex-wrap items-center justify-between gap-4"><LobbyRangeSelect :live="live" /><label v-if="!live" class="flex items-center gap-2 text-sm">{{ t('lobby.analytics.peakPeriod') }}<select :disabled="!mounted" class="min-h-11 rounded-md border border-border bg-card p-2 text-base" :value="peak" @change="router.replace({ query: { ...route.query, peak: ($event.target as HTMLSelectElement).value } })"><option v-for="period in ['today','7d','30d','90d','all']" :key="period" :value="period">{{ t(lobbyLabel(`ranges.${period}`)) }}</option></select></label></div>
			<div v-if="!live" data-testid="lobby-peak-cards" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard class="[&_dl]:grid-cols-1 [&_dt]:whitespace-normal [&_dd]:whitespace-normal [&_dd]:break-words" v-for="card in peaks" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :icon="card.icon ?? 'chart-line'">
				<template #details>
					<dl class="mt-3 space-y-2 border-t border-border pt-3 text-sm">
						<div v-for="detail in card.details" :key="detail.label"><dt class="text-xs text-muted-foreground">{{ detail.label }}</dt><dd class="break-words"><NuxtLink v-if="card.to" :to="card.to" class="text-primary hover:underline">{{ detail.value }}</NuxtLink><span v-else>{{ detail.value }}</span></dd></div>
						<div><dt class="text-xs text-muted-foreground">{{ t('lobby.analytics.observedAt') }}</dt><dd class="mt-1 tabular-nums"><NuxtTime v-if="card.timestamp" :datetime="card.timestamp" :locale="locale" date-style="short" time-style="short" :hour12="false" /><span v-else>{{ t('common.unavailable') }}</span></dd></div>
					</dl>
				</template>
			</StatCard></div>
			<div class="space-y-6">
				<LobbyChart :title="t('lobby.analytics.playerActivity')" :points="points" :series="playerSeries" />
				<template v-if="!live">
					<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard v-for="card in summary" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :to="card.to" icon="chart-line" /></div>
					<LobbyChart :title="t('lobby.analytics.roomActivity')" :points="points" :series="roomSeries" />
					<LobbyChart :title="t('lobby.analytics.averagePerRoom')" :points="points" :series="perRoomSeries" />
				</template>
			</div>
	</div>
</template>
