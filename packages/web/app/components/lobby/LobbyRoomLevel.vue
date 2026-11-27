<script setup lang="ts">
import { type LobbyRoom, lobbyRoundLength } from '~/utils/lobbyAnalytics'

const props = defineProps<{ room: LobbyRoom }>()
const { t, locale } = useAppI18n()
const length = computed(() => lobbyRoundLength(props.room.roundTime, locale.value))
const phase = computed(() => {
	switch (props.room.gameState) {
		case 0: return t('lobby.analytics.racing')
		case 1: return t('lobby.analytics.endOfRound')
		case 2: return t('lobby.analytics.podium')
		default: return t('common.unavailable')
	}
})
</script>

<template>
	<div class="min-w-36 space-y-1 break-words">
		<p v-if="room.closedAt" class="text-xs text-muted-foreground">{{ t('lobby.analytics.lastObservedRound') }}</p>
		<NuxtLink v-if="room.levelName && room.levelWorkshopId" :to="`/workshop/${room.levelWorkshopId}`" class="font-medium text-primary hover:underline">{{ room.levelName }}</NuxtLink>
		<p v-else class="font-medium">{{ room.levelName || t('common.unavailable') }}</p>
		<p v-if="room.levelAuthor" class="text-sm text-muted-foreground">
			<span class="sr-only">{{ t('lobby.analytics.levelAuthor') }} </span>
			<NuxtLink v-if="room.levelAuthorSteamId" :to="`/user/${room.levelAuthorSteamId}`" class="text-primary hover:underline">{{ room.levelAuthor }}</NuxtLink>
			<span v-else>{{ room.levelAuthor }}</span>
		</p>
		<dl class="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
			<div><dt class="sr-only">{{ t('lobby.analytics.roundLength') }}</dt><dd>{{ length ?? t('common.unavailable') }}</dd></div>
			<div><dt class="sr-only">{{ t('lobby.analytics.gameState') }}</dt><dd>{{ phase }}</dd></div>
		</dl>
	</div>
</template>
