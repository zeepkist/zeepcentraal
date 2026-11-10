<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { lobbyObservationIsStale } from '~/utils/lobbyAnalytics'

const props = defineProps<{ observedAt?: unknown; error?: string }>()
const { t } = useAppI18n()
const now = useNow({ scheduler: callback => useIntervalFn(callback, 1000) })
const mounted = shallowRef(false)
onMounted(() => { mounted.value = true })
const stale = computed(() => mounted.value && lobbyObservationIsStale(props.observedAt, now.value.getTime()))
</script>

<template>
	<div v-if="error || stale" class="space-y-2 text-sm" role="status">
		<UAlert v-if="error" color="warning" :title="t('lobby.analytics.connectionError')" :description="error" />
		<UAlert v-if="stale" color="warning" :title="t('lobby.analytics.stale')" />
	</div>
</template>
