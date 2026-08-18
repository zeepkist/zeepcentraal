<template>
	<div class="mx-auto w-full max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
		<PageHeader
			:eyebrow="$t('pages.lobby.eyebrow')"
			:title="$t('pages.lobby.title')"
			:description="$t('pages.lobby.description')"
		/>
		<div class="space-y-6">
			<LobbySummary :stats="stats" :labels="summaryLabels" />

			<UAlert
				v-if="snapshot?.status === 'connecting'"
				color="info"
				:title="$t('lobby.status.connecting.title')"
				:description="$t('lobby.status.connecting.description')"
			>
				<template #icon><TablerIcon name="loader-2" class="animate-spin" /></template>
			</UAlert>
			<UAlert
				v-else-if="snapshot?.status === 'stale'"
				color="warning"
				:title="$t('lobby.status.stale.title')"
				:description="$t('lobby.status.stale.description')"
			>
				<template #icon><TablerIcon name="alert-triangle" /></template>
			</UAlert>
			<UAlert
				v-else-if="snapshot?.status === 'unavailable'"
				color="neutral"
				:title="$t('lobby.status.unavailable.title')"
				:description="$t('lobby.status.unavailable.description')"
			>
				<template #icon><TablerIcon name="database-off" /></template>
			</UAlert>
			<div
				v-else-if="snapshot?.status === 'live'"
				class="flex items-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<span class="size-2 rounded-full bg-success" aria-hidden="true" />
				{{ $t('lobby.status.live') }}
			</div>

			<DataState
				:pending="pending && !snapshot"
				:error="!snapshot ? error?.message : null"
				:empty="snapshot?.status === 'live' && snapshot.lobbies.length === 0"
				:loading-label="$t('common.loading')"
				:error-title="$t('common.error')"
				:empty-title="$t('lobby.empty')"
			>
				<LobbyTable :lobbies="snapshot?.lobbies ?? []" :labels="tableLabels" />
			</DataState>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
import type { LobbySnapshot } from '@zeepkist/core'

usePageSeo('lobby')
const { t } = useI18n()
const { snapshot, pending, error } = await useLobbyFeed()
const emptyStats: LobbySnapshot['stats'] = {
	onlinePlayers: null,
	lobbyCount: null,
	playersInLobbies: null,
}
const stats = computed(() => snapshot.value?.stats ?? emptyStats)
const summaryLabels = computed(() => ({
	onlinePlayers: t('lobby.summary.onlinePlayers'),
	lobbies: t('lobby.summary.lobbies'),
	playersInLobbies: t('lobby.summary.playersInLobbies'),
	unavailable: t('common.unavailable'),
}))
const tableLabels = computed(() => ({
	room: t('lobby.table.room'),
	host: t('lobby.table.host'),
	players: t('lobby.table.players'),
	privateLobby: t('lobby.table.privateLobby'),
}))
</script>
