<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { LOBBY_STALE_MS } from '~/utils/lobbyAnalytics'

const props = defineProps<{ observedAt?: unknown; error?: string; connecting?: boolean }>()
const { t, locale } = useAppI18n()
const now = useNow({ scheduler: callback => useIntervalFn(callback, 1000) })
const mounted = shallowRef(false)
onMounted(() => { mounted.value = true })
const observed = computed(() => typeof props.observedAt === 'string' ? props.observedAt : undefined)
const age = computed(() => observed.value && mounted.value ? Math.max(0, now.value.getTime()-Date.parse(observed.value)) : null)
const timestamp = computed(() => observed.value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'long', ...(!mounted.value ? { timeZone: 'UTC' } : {}) }).format(new Date(observed.value)) : t('common.unavailable'))
</script>

<template>
	<div class="space-y-2 text-sm" role="status">
		<p class="text-muted-foreground">{{ t('lobby.analytics.lastObservation') }}: <time :datetime="observed">{{ timestamp }}</time><span v-if="age !== null"> · {{ t('lobby.analytics.secondsAgo', { count: Math.floor(age/1000) }) }}</span></p>
		<UAlert v-if="error" color="warning" :title="t('lobby.analytics.connectionError')" :description="error" />
		<p v-else-if="connecting" class="text-muted-foreground">{{ t('lobby.analytics.connecting') }}</p>
		<UAlert v-if="!observedAt || (age !== null && age > LOBBY_STALE_MS)" color="warning" :title="t('lobby.analytics.stale')" :description="t('lobby.analytics.staleDescription')" />
	</div>
</template>
