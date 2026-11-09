<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { type LobbyRoom, lobbyDuration } from '~/utils/lobbyAnalytics'

defineProps<{ rooms: LobbyRoom[]; history?: boolean }>()
const { t, locale } = useAppI18n()
const now = useNow({ scheduler: callback => useIntervalFn(callback, 1000) })
const mounted = shallowRef(false)
onMounted(() => { mounted.value = true })
const number = computed(() => new Intl.NumberFormat(locale.value))
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short', ...(!mounted.value ? { timeZone: 'UTC' } : {}) }).format(new Date(value)) : t('common.unavailable')
function duration(room: LobbyRoom) {
	const value = lobbyDuration(room.firstSeen, room.closedAt ?? (!mounted.value ? room.lastSeen : null), now.value.getTime())
	return t('lobby.analytics.durationValue', value)
}
</script>

<template>
	<div class="overflow-x-auto rounded-lg border border-border">
		<DataTableFrame><table class="w-full min-w-4xl text-left text-sm"><thead><tr><th scope="col" class="px-4 py-3">{{ t('lobby.table.room') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.table.host') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.table.players') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.peakPlayers') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.observedSpan') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.firstSeen') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.lastSeen') }}</th><th scope="col" class="px-4 py-3" v-if="history">{{ t('lobby.analytics.closedAt') }}</th></tr></thead>
		<tbody><DataTableRow v-for="room in rooms" :key="String(room.id)">
			<td class="px-4 py-3"><NuxtLink :to="`/lobby/${room.id}`" class="break-words font-medium text-primary hover:underline">{{ room.roomName }}</NuxtLink><div class="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><TablerIcon v-if="!room.isPublic" name="lock" class="size-3" />{{ t(room.isPublic ? 'lobby.analytics.public' : 'lobby.analytics.private') }} · {{ t(room.closedAt ? 'lobby.analytics.closed' : mounted && now.getTime()-Date.parse(room.lastSeen)>120_000 ? 'lobby.analytics.staleRoom' : 'lobby.analytics.active') }}</div></td>
			<td class="px-4 py-3"><NuxtLink v-if="room.host" :to="`/user/${room.host.steamId}`" class="break-words hover:underline">{{ room.host.steamName || t('lobby.analytics.unknownHost') }}</NuxtLink><span v-else>{{ t('lobby.analytics.unknownHost') }}</span></td>
			<td class="px-4 py-3"><span class="whitespace-nowrap tabular-nums">{{ number.format(room.players ?? 0) }} / {{ number.format(room.playerLimit ?? 0) }}</span><meter v-if="room.playerLimit && room.playerLimit > 0" class="mt-1 block w-20" :min="0" :max="room.playerLimit" :value="Math.min(room.players ?? 0, room.playerLimit)" :aria-label="t('lobby.analytics.occupancy')" /></td>
			<td class="px-4 py-3">{{ number.format(room.peakPlayers ?? 0) }}</td><td class="px-4 py-3 whitespace-nowrap">{{ duration(room) }}</td><td class="px-4 py-3">{{ date(room.firstSeen) }}</td><td class="px-4 py-3">{{ date(room.lastSeen) }}</td><td class="px-4 py-3" v-if="history">{{ date(room.closedAt) }}</td>
		</DataTableRow></tbody></table></DataTableFrame>
	</div>
</template>
