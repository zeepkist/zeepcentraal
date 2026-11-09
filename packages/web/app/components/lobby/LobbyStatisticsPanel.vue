<script setup lang="ts">
import type { StatisticMetric } from '~/types/app'
import { hasLobbyPeriodCoverage, type LobbyChartPoint, lobbyChange, lobbyNumber, lobbyRatio, rangeDuration, withLobbyChartGaps } from '~/utils/lobbyAnalytics'
import { lobbyLabel } from '~/utils/lobbyLabels'

const props = defineProps<{ live?: boolean }>()
const { t } = useAppI18n()
const route = useRoute()
const router = useRouter()
const { data, error, fetching, connecting, range, peak, anchor } = useLobbyStatistics(props.live)
const { number, date, mounted } = useLobbyFormat()
const latest = computed(() => data.value?.latest?.nodes[0])
const cards = computed<StatisticMetric[]>(() => [
	{ key: 'online', label: t('lobby.summary.onlinePlayers'), value: number(latest.value?.players), icon: 'users' },
	{ key: 'rooms', label: t('lobby.summary.playersInLobbies'), value: number(latest.value?.playersInRooms), icon: 'users-group' },
	{ key: 'active', label: t('lobby.summary.lobbies'), value: number(latest.value?.rooms), icon: 'server' },
	{ key: 'outside', label: t('lobby.analytics.outside'), value: number(latest.value ? latest.value.players-latest.value.playersInRooms : null), icon: 'user' },
])
const peaks = computed<StatisticMetric[]>(() => {
	const online = data.value?.onlinePeak?.nodes[0], rooms = data.value?.roomsPeak?.nodes[0], participation = data.value?.participationPeak?.nodes[0], room = data.value?.roomPeak?.nodes[0]
	return [
		{ key: 'online', label: t('lobby.analytics.peakOnline'), value: number(online?.players), details: [{ label: t('lobby.analytics.observedAt'), value: date(online?.dateCreated) }] },
		{ key: 'participation', label: t('lobby.analytics.peakInRooms'), value: number(participation?.playersInRooms), details: [{ label: t('lobby.analytics.observedAt'), value: date(participation?.dateCreated) }] },
		{ key: 'rooms', label: t('lobby.analytics.peakRooms'), value: number(rooms?.rooms), details: [{ label: t('lobby.analytics.observedAt'), value: date(rooms?.dateCreated) }] },
		{ key: 'room', label: t('lobby.analytics.peakSingleRoom'), value: number(room?.peakPlayers), to: room ? `/lobby/${room.id}` : undefined, details: [{ label: t('lobby.analytics.allTime'), value: room?.roomName ?? t('common.unavailable') }, { label: t('lobby.analytics.observedAt'), value: date(room?.peakTime) }] },
	]
})
const averages = computed(() => data.value?.period?.aggregates)
const summary = computed<StatisticMetric[]>(() => {
	const value = averages.value, previous = data.value?.previous?.aggregates
	const duration = rangeDuration(range.value)
	const enough = range.value !== 'all' && hasLobbyPeriodCoverage(anchor.value-duration,anchor.value,data.value?.period?.nodes[0]?.dateCreated,latest.value?.dateCreated) && hasLobbyPeriodCoverage(anchor.value-duration*2,anchor.value-duration,data.value?.previous?.nodes[0]?.dateCreated,data.value?.previousEnd?.nodes[0]?.dateCreated)
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
	const rows = (data.value?.period?.groupedAggregates ?? []).map(bucket => ({
		time: Date.parse(bucket.keys?.[0] ?? ''), online: lobbyNumber(bucket.average?.players), inRooms: lobbyNumber(bucket.average?.playersInRooms),
		outside: bucket.average?.players != null && bucket.average?.playersInRooms != null ? Number(bucket.average.players)-Number(bucket.average.playersInRooms) : null,
		rooms: lobbyNumber(bucket.average?.rooms), onlineMax: bucket.max?.players ?? null, inRoomsMax: bucket.max?.playersInRooms ?? null,
		roomsMax: bucket.max?.rooms ?? null, perRoom: lobbyRatio(bucket.sum?.playersInRooms,bucket.sum?.rooms), samples: Number(bucket.distinctCount?.id ?? 0),
	})).filter(point => Number.isFinite(point.time)).sort((a,b) => a.time-b.time)
	const interval = ({ '24h': 300_000, '7d': 3_600_000, '30d': 21_600_000, '90d': 86_400_000, '1y': 86_400_000, all: 2_764_800_000 })[range.value]
	return withLobbyChartGaps(rows,interval)
})
const daily = computed<LobbyChartPoint[]>(() => {
	const days = new Map<number,{ count: number; online: number; rooms: number; onlineMax: number; roomsMax: number }>()
	for (const point of points.value) {
		const count = point.samples ?? 0
		if (!count) continue
		const day = Math.floor(point.time/86_400_000)*86_400_000
		const previous = days.get(day) ?? { count: 0, online: 0, rooms: 0, onlineMax: 0, roomsMax: 0 }
		days.set(day,{ count: previous.count+count, online: previous.online+(point.online ?? 0)*count, rooms: previous.rooms+(point.rooms ?? 0)*count, onlineMax: Math.max(previous.onlineMax,point.onlineMax ?? 0), roomsMax: Math.max(previous.roomsMax,point.roomsMax ?? 0) })
	}
	return withLobbyChartGaps([...days].map(([time,value]) => ({ time, online: value.online/value.count, rooms: value.rooms/value.count, onlineMax: value.onlineMax, roomsMax: value.roomsMax })),range.value === 'all' ? 31*86_400_000 : 86_400_000)
})
const series = (key: string, color: string, label = key) => ({ key, color, label: t(lobbyLabel(label)) })
const playerSeries = computed(() => [series('online','#38bdf8'),series('inRooms','#a78bfa'),...(!props.live ? [series('outside','#fb923c'),series('onlineMax','#0284c7'),series('inRoomsMax','#7c3aed')] : [])])
</script>

<template>
	<div class="space-y-6">
		<DataState :pending="fetching && !data" :error="!data ? error?.message : null" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('common.empty')">
			<div v-if="live" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard v-for="card in cards" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :to="card.to" :icon="card.icon ?? 'dashboard'" /></div>
			<LobbyFreshness :observed-at="latest?.dateCreated" :error="data ? error?.message : undefined" :connecting="connecting" />
			<div class="my-4 flex flex-wrap items-center justify-between gap-4"><LobbyRangeSelect :live="live" /><label v-if="!live" class="flex items-center gap-2 text-sm">{{ t('lobby.analytics.peakPeriod') }}<select :disabled="!mounted" class="min-h-11 rounded-md border border-border bg-card p-2 text-base" :value="peak" @change="router.replace({ query: { ...route.query, peak: ($event.target as HTMLSelectElement).value } })"><option v-for="period in ['today','7d','30d','90d','all']" :key="period" :value="period">{{ t(lobbyLabel(`ranges.${period}`)) }}</option></select></label></div>
			<div v-if="!live" class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard class="[&_dl]:grid-cols-1 [&_dt]:whitespace-normal [&_dd]:whitespace-normal [&_dd]:break-words" v-for="card in peaks" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :to="card.to" :icon="card.icon ?? 'chart-line'" /></div>
			<p class="mb-4 text-sm text-muted-foreground">{{ t('lobby.analytics.sampleWarning') }}</p>
			<div class="space-y-6">
				<LobbyChart :title="t('lobby.analytics.playerActivity')" :points="points" :series="playerSeries" />
				<template v-if="!live">
					<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><StatCard v-for="card in summary" :key="card.key" :label="card.label" :value="card.value" :details="card.details" :to="card.to" icon="chart-line" /></div>
					<LobbyChart :title="t('lobby.analytics.roomActivity')" :points="points" :series="[series('rooms','#34d399'),series('roomsMax','#059669')]" />
					<LobbyChart :title="t('lobby.analytics.averagePerRoom')" :points="points" :series="[series('perRoom','#fbbf24','averagePerRoom')]" />
					<p class="text-sm text-muted-foreground">{{ t('lobby.analytics.capacityUnavailable') }}</p>
					<LobbyChart :title="t(range === 'all' ? 'lobby.analytics.monthlyPlayers' : 'lobby.analytics.dailyPlayers')" :points="daily" :series="[series('online','#38bdf8'),series('onlineMax','#0284c7')]" />
					<LobbyChart :title="t(range === 'all' ? 'lobby.analytics.monthlyRooms' : 'lobby.analytics.dailyRooms')" :points="daily" :series="[series('rooms','#34d399'),series('roomsMax','#059669')]" />
				</template>
			</div>
		</DataState>
	</div>
</template>
