<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { Zc_LobbyDetailDocument, Zc_LobbyDetailLiveDocument } from '@zeepkist/graphql/generated'
import { type LobbyChartPoint, mapLobbyPage, mapLobbyRoom } from '~/utils/lobbyAnalytics'
import { lobbyLabel } from '~/utils/lobbyLabels'

const { t } = useAppI18n()
const route = useRoute()
const pagination = useCursorPagination(50)
const id = computed(() => {
	const value = String('id' in route.params ? route.params.id : '')
	return /^\d{1,19}$/.test(value) && BigInt(value) <= 9223372036854775807n ? value : '0'
})
const variables = computed(() => ({ id: id.value, ...pagination.variables.value }))
const { data, error, fetching, connecting } = useLobbyOperation(Zc_LobbyDetailDocument, Zc_LobbyDetailLiveDocument, variables)
const { number, date, duration, mounted } = useLobbyFormat()
const room = computed(() => data.value?.lobbyListing ? mapLobbyRoom(data.value.lobbyListing) : null)
const events = computed(() => data.value?.lobbyHistories?.nodes ?? [])
const page = computed(() => mapLobbyPage(data.value?.lobbyHistories?.pageInfo))
const now = useNow({ scheduler: callback => useIntervalFn(callback, 1000) })
const fields = computed<Array<[string,string]>>(() => room.value ? [
	['status',t(room.value.closedAt ? 'lobby.analytics.closed' : mounted.value && now.value.getTime()-Date.parse(room.value.lastSeen)>120_000 ? 'lobby.analytics.staleRoom' : 'lobby.analytics.active')],
	['visibility',t(room.value.isPublic ? 'lobby.analytics.public' : 'lobby.analytics.private')],
	['firstSeen',date(room.value.firstSeen)],['lastSeen',date(room.value.lastSeen)],['closedAt',date(room.value.closedAt)],
	['observedSpan',duration(room.value.firstSeen,room.value.closedAt ?? (!mounted.value ? room.value.lastSeen : null),now.value.getTime())],
	['players',number(room.value.players)],['playerLimit',number(room.value.playerLimit)],['peakPlayers',number(room.value.peakPlayers)],['peakTime',date(room.value.peakTime)],
] : [])
const points = computed<LobbyChartPoint[]>(() => {
	const result: LobbyChartPoint[] = []
	for (const bucket of data.value?.lobbyOccupancyTimeline?.nodes ?? []) {
		const first = Date.parse(String(bucket.firstObservedAt ?? '')), last = Date.parse(String(bucket.lastObservedAt ?? ''))
		if (!Number.isFinite(first) || !Number.isFinite(last)) continue
		const empty = (time: number): LobbyChartPoint => ({ time,players:null,capacity:null,min:null,max:null,minCapacity:null,maxCapacity:null })
		if (bucket.hasGap || bucket.hasReopening) result.push(empty(first-1))
		const values = { min: bucket.minPlayers ?? null,max: bucket.maxPlayers ?? null,minCapacity: bucket.minCapacity ?? null,maxCapacity: bucket.maxCapacity ?? null }
		result.push({ time:first,players:bucket.firstPlayers ?? null,capacity:bucket.firstCapacity ?? null,...values })
		if (last>first) {
			if (bucket.hasGap || bucket.hasClosure || bucket.hasReopening) result.push(empty(last-1))
			result.push({ time:last,players:bucket.lastPlayers ?? null,capacity:bucket.lastCapacity ?? null,...values })
		}
		if (bucket.hasClosure) result.push(empty(last+1))
	}
	return result
})
const series = computed(() => [
	{ key:'players',label:t('lobby.analytics.players'),color:'#38bdf8' },{ key:'capacity',label:t('lobby.analytics.playerLimit'),color:'#a78bfa' },
	{ key:'min',label:t('lobby.analytics.bucketMin'),color:'#0284c7' },{ key:'max',label:t('lobby.analytics.bucketMax'),color:'#fb923c' },
	{ key:'minCapacity',label:t('lobby.analytics.capacityMin'),color:'#8b5cf6' },{ key:'maxCapacity',label:t('lobby.analytics.capacityMax'),color:'#c4b5fd' },
])
const names = computed(() => [...new Set(events.value.map(event => event.roomName))])
const hosts = computed(() => [...new Map(events.value.map(event => [String(event.hostId),event.host])).entries()])
const changes = computed(() => events.value.map((event,index) => {
	const previous = events.value[index-1]
	if (!previous) return ''
	return (['roomName','players','playerLimit','isPublic','hostId'] as const).filter(key => event[key] !== previous[key]).map(key => `${t(lobbyLabel(`eventFields.${key}`))}: ${String(previous[key])} / ${String(event[key])}`).join(' · ')
}))
const eventLabel = (value: string) => ['opened','updated','closed','reopened'].includes(value) ? t(lobbyLabel(`events.${value}`)) : value
</script>

<template>
	<DataState :pending="fetching && !data" :error="!data ? error?.message : null" :empty="!!data && !room" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('lobby.analytics.notFound')">
		<div v-if="room" class="space-y-6">
			<h2 class="break-words text-2xl font-bold">{{ room.roomName }}</h2>
			<p>{{ t('lobby.table.host') }}: <NuxtLink v-if="room.host" :to="`/user/${room.host.steamId}`" class="text-primary hover:underline">{{ room.host.steamName || t('lobby.analytics.unknownHost') }}</NuxtLink><span v-else>{{ t('lobby.analytics.unknownHost') }}</span></p>
			<LobbyFreshness v-if="!room.closedAt" :observed-at="room.lastSeen" :error="error?.message" :connecting="connecting" />
			<UAlert v-else-if="error" color="warning" :title="t('lobby.analytics.connectionError')" :description="error.message" />
			<UCard><dl class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div v-for="[key,value] in fields" :key="key"><dt class="text-sm text-muted-foreground">{{ t(lobbyLabel(key)) }}</dt><dd class="mt-1 font-medium">{{ value }}</dd></div></dl><p class="mt-5 text-sm text-muted-foreground">{{ t('lobby.analytics.spanWarning') }}</p></UCard>
			<LobbyChart :title="t('lobby.analytics.roomTimeline')" :points="points" :series="series" step />
			<p class="text-sm text-muted-foreground">{{ t('lobby.analytics.timelineWarning') }}</p>
			<section class="space-y-4"><h2 class="text-xl font-semibold">{{ t('lobby.analytics.eventHistory') }}</h2>
				<p class="text-sm text-muted-foreground">{{ t('lobby.analytics.eventWarning') }}</p>
				<DataTableFrame><table class="w-full min-w-3xl text-left text-sm"><thead><tr><th v-for="key in ['timestamp','event','roomName','players','playerLimit','visibility','host']" :key="key" scope="col" class="px-4 py-3">{{ t(lobbyLabel(key)) }}</th></tr></thead><tbody><DataTableRow v-for="(event,index) in events" :key="String(event.id)"><td class="px-4 py-3">{{ date(event.observedAt) }}</td><td class="px-4 py-3">{{ eventLabel(event.changeType) }}<p v-if="changes[index]" class="mt-1 max-w-xs break-words text-xs text-muted-foreground">{{ changes[index] }}</p></td><td class="px-4 py-3 break-words">{{ event.roomName }}</td><td class="px-4 py-3">{{ number(event.players) }}</td><td class="px-4 py-3">{{ number(event.playerLimit) }}</td><td class="px-4 py-3">{{ t(event.isPublic ? 'lobby.analytics.public' : 'lobby.analytics.private') }}</td><td class="px-4 py-3"><NuxtLink v-if="event.host" :to="`/user/${event.host.steamId}`" class="hover:underline">{{ event.host.steamName || t('lobby.analytics.unknownHost') }}</NuxtLink><span v-else>{{ t('lobby.analytics.unknownHost') }}</span></td></DataTableRow></tbody></table></DataTableFrame>
				<p v-if="!events.length" class="text-muted-foreground">{{ t('lobby.analytics.noObservations') }}</p>
				<div :inert="!mounted"><WorkshopPagination :page="page" :pagination="pagination" :pending="fetching" /></div>
			</section>
			<UCard><h2 class="font-semibold">{{ t('lobby.analytics.recordedNames') }}</h2><ul class="mt-2 list-inside list-disc"><li v-for="name in names" :key="name">{{ name }}</li></ul><h2 class="mt-4 font-semibold">{{ t('lobby.analytics.recordedHosts') }}</h2><ul class="mt-2 list-inside list-disc"><li v-for="[id,host] in hosts" :key="id"><NuxtLink v-if="host" :to="`/user/${host.steamId}`" class="hover:underline">{{ host.steamName || t('lobby.analytics.unknownHost') }}</NuxtLink><span v-else>{{ t('lobby.analytics.unknownHost') }}</span></li></ul></UCard>
		</div>
	</DataState>
</template>
