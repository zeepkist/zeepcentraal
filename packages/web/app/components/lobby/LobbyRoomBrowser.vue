<script setup lang="ts">
const props = defineProps<{ history?: boolean }>()
const { t } = useAppI18n()
const { rooms, page, pagination, data, error, fetching } = useLobbyRooms(props.history)
const mounted=shallowRef(false)
onMounted(()=> { mounted.value=true })
</script>

<template>
	<section class="space-y-4">
		<h2 class="text-xl font-semibold">{{ t(history ? 'lobby.analytics.history' : 'lobby.analytics.activeRooms') }}</h2>
		<LobbyRoomFilters :history="history" />
		<UAlert v-if="data && error" color="warning" :title="t('lobby.analytics.connectionError')" :description="error.message" />
		<DataState :pending="fetching && !data" :error="!data ? error?.message : null" :empty="!!data && !rooms.length" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t(history ? 'lobby.analytics.noResults' : 'lobby.empty')">
			<LobbyRoomTable :rooms="rooms" :history="history" />
		</DataState>
		<div :inert="!mounted"><WorkshopPagination :page="page" :pagination="pagination" :pending="fetching" /></div>
	</section>
</template>
