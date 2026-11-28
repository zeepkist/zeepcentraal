<script setup lang="ts">
import type { LobbyRoom } from '~/utils/lobbyAnalytics'

const props = defineProps<{ rooms: LobbyRoom[]; history?: boolean }>()
const { t, locale } = useAppI18n()
const latestOpenStart = computed(() => props.rooms.reduce((latest, room) =>
	room.closedAt ? latest : Math.max(latest, Date.parse(room.firstSeen)), -Infinity))
const now = useLobbyClock(() => props.rooms.some(room => !room.closedAt), latestOpenStart)
const { duration, mounted } = useLobbyFormat()
const number = computed(() => new Intl.NumberFormat(locale.value))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short', ...(!mounted.value ? { timeZone: 'UTC' } : {}) }))
const date = (value: string | null | undefined) => value ? dateFormatter.value.format(new Date(value)) : t('common.unavailable')
function roomDuration(room: LobbyRoom) {
	return duration(room.firstSeen, room.closedAt ?? (!mounted.value ? room.lastSeen : null), now.value.getTime())
}
</script>

<template>
	<div class="overflow-x-auto rounded-lg border border-border">
		<DataTableFrame><table class="w-full min-w-5xl text-left text-sm"><thead><tr><th scope="col" class="px-4 py-3">{{ t('lobby.table.room') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.table.host') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.level') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.table.players') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.peakPlayers') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.observedSpan') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.firstSeen') }}</th><th scope="col" class="px-4 py-3">{{ t('lobby.analytics.lastSeen') }}</th><th scope="col" class="px-4 py-3" v-if="history">{{ t('lobby.analytics.closedAt') }}</th></tr></thead>
		<tbody><DataTableRow v-for="room in rooms" :key="String(room.id)">
			<td class="px-4 py-3">
				<div class="flex items-center gap-1.5">
					<span v-if="room.isPublic === false" class="inline-flex shrink-0 text-muted-foreground" :title="t('lobby.analytics.private')">
						<TablerIcon name="lock" class="size-4" aria-hidden="true" />
						<span class="sr-only">{{ t('lobby.analytics.private') }}</span>
					</span>
					<NuxtLink :to="`/lobby/${room.id}`" class="break-words font-medium text-primary hover:underline">{{ room.roomName }}</NuxtLink>
				</div>
				<LobbyRoomRoundSummary :room="room" class="mt-1" />
			</td>
			<td class="px-4 py-3"><NuxtLink v-if="room.host" :to="`/user/${room.host.steamId}`" class="break-words hover:underline">{{ room.host.steamName || t('lobby.analytics.unknownHost') }}</NuxtLink><span v-else>{{ t('lobby.analytics.unknownHost') }}</span></td>
			<td class="px-4 py-3"><LobbyRoomLevel :room="room" /></td>
			<td class="px-4 py-3">
				<span v-if="room.closedAt">{{ t('lobby.analytics.closed') }}</span>
				<template v-else>
					<span class="whitespace-nowrap tabular-nums">{{ number.format(room.players ?? 0) }} / {{ number.format(room.playerLimit ?? 0) }}</span>
					<meter v-if="room.playerLimit && room.playerLimit > 0" class="mt-1 block h-1.5 w-20 overflow-hidden rounded-full" :min="0" :max="room.playerLimit" :value="Math.min(room.players ?? 0, room.playerLimit)" :aria-label="t('lobby.analytics.occupancy')" />
				</template>
			</td>
			<td class="px-4 py-3">{{ number.format(room.peakPlayers ?? 0) }}</td><td class="px-4 py-3 whitespace-nowrap">{{ roomDuration(room) }}</td><td class="px-4 py-3">{{ date(room.firstSeen) }}</td><td class="px-4 py-3">{{ date(room.lastSeen) }}</td><td class="px-4 py-3" v-if="history">{{ date(room.closedAt) }}</td>
		</DataTableRow></tbody></table></DataTableFrame>
	</div>
</template>

<style scoped>
meter {
	appearance: none;
	background: var(--color-muted);
}

meter::-webkit-meter-bar {
	background: var(--color-muted);
	border: 0;
}

meter::-webkit-meter-optimum-value {
	background: var(--color-primary);
}

meter::-moz-meter-bar {
	background: var(--color-primary);
}
</style>
