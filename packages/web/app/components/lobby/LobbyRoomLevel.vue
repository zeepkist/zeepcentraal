<script setup lang="ts">
import type { LobbyRoom } from '~/utils/lobbyAnalytics'

defineProps<{ room: LobbyRoom }>()
const { t } = useAppI18n()
</script>

<template>
	<div class="min-w-36 space-y-1 break-words">
		<NuxtLink v-if="room.levelName && room.levelWorkshopId" :to="`/workshop/${room.levelWorkshopId}`" class="font-medium text-primary hover:underline">{{ room.levelName }}</NuxtLink>
		<p v-else class="font-medium">{{ room.levelName || t('common.unavailable') }}</p>
		<p v-if="room.levelAuthor" class="text-sm text-muted-foreground">
			<span class="sr-only">{{ t('lobby.analytics.levelAuthor') }} </span>
			<NuxtLink v-if="room.levelAuthorSteamId" :to="`/user/${room.levelAuthorSteamId}`" class="text-primary hover:underline">{{ room.levelAuthor }}</NuxtLink>
			<span v-else>{{ room.levelAuthor }}</span>
		</p>
	</div>
</template>
