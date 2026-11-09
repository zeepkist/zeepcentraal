<script setup lang="ts">
import { LOBBY_RANGES, normalizeLobbyRange } from '~/utils/lobbyAnalytics'
import { lobbyLabel } from '~/utils/lobbyLabels'

const props = withDefaults(defineProps<{ live?: boolean }>(), { live: false })
const { t } = useAppI18n()
const route = useRoute()
const router = useRouter()
const mounted=shallowRef(false)
onMounted(()=> { mounted.value=true })
const selected = computed(()=> {
	const value=normalizeLobbyRange(route.query.range)
	return props.live && !['24h','7d','30d'].includes(value) ? '24h' : value
})
</script>

<template>
	<label class="flex items-center gap-3 text-sm">{{ t('lobby.analytics.range') }}
		<select :disabled="!mounted" :aria-label="t('lobby.analytics.range')" class="min-h-11 rounded-md border border-border bg-card p-2 text-base" :value="selected" @change="router.replace({ query: { ...route.query, range: ($event.target as HTMLSelectElement).value } })">
			<option v-for="range in live ? LOBBY_RANGES.slice(0,3) : LOBBY_RANGES" :key="range" :value="range">{{ t(lobbyLabel(`ranges.${range}`)) }}</option>
		</select>
	</label>
</template>
