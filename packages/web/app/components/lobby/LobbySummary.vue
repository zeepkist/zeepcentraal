<template>
	<MetricGrid :metrics="metrics" :columns="3" />
</template>

<script setup vapor lang="ts">
import type { LobbySnapshot } from '@zeepkist/core'
import { getNumberFormatter } from '~/utils/intlFormatters'

const props = defineProps<{
	stats: LobbySnapshot['stats']
	labels: {
		onlinePlayers: string
		lobbies: string
		playersInLobbies: string
		unavailable: string
	}
}>()

const { locale } = useI18n()
const number = computed(() => getNumberFormatter(locale.value))
const format = (value: number | null) =>
	value === null ? props.labels.unavailable : number.value.format(value)
const metrics = computed(() => [
	{
		key: 'online-players',
		label: props.labels.onlinePlayers,
		value: format(props.stats.onlinePlayers),
		icon: 'users' as const,
	},
	{
		key: 'lobbies',
		label: props.labels.lobbies,
		value: format(props.stats.lobbyCount),
		icon: 'server' as const,
	},
	{
		key: 'players-in-lobbies',
		label: props.labels.playersInLobbies,
		value: format(props.stats.playersInLobbies),
		icon: 'users-group' as const,
	},
])
</script>
