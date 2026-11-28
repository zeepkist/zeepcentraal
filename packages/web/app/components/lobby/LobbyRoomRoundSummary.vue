<script setup lang="ts">
import { type LobbyRoom, lobbyRoundLength } from '~/utils/lobbyAnalytics'

const props = defineProps<{ room: LobbyRoom }>()
const { t, locale } = useAppI18n()
const length = computed(() => lobbyRoundLength(props.room.roundTime, locale.value))
const number = computed(() => new Intl.NumberFormat(locale.value))
const levelsPlayed = computed(() => {
	const stored = BigInt(props.room.levelsPlayed ?? '0')
	const count = stored > 0n ? stored : 1n
	return t('lobby.analytics.levelsPlayed', { count: number.value.format(count) }, Number(count))
})
</script>

<template>
	<dl v-if="room.isPublic" class="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
		<div><dt class="sr-only">{{ t('lobby.analytics.roundLength') }}</dt><dd>{{ length ?? t('common.unavailable') }}</dd></div>
		<div><dt class="sr-only">{{ t('lobby.analytics.levelsPlayedLabel') }}</dt><dd>{{ levelsPlayed }}</dd></div>
	</dl>
</template>
