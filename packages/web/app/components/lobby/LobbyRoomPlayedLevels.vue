<script setup lang="ts">
import { Zc_LobbyPlayedLevelsDocument, Zc_LobbyPlayedLevelsLiveDocument } from '@zeepkist/graphql/generated'
import { mapLobbyPage } from '~/utils/lobbyAnalytics'

const props = defineProps<{ roomId: string }>()
const { t } = useAppI18n()
const pagination = useCursorPagination(24, 'levels')
const variables = computed(() => ({ id: props.roomId, ...pagination.variables.value }))
const { data, error, fetching } = useLobbyOperation(
	Zc_LobbyPlayedLevelsDocument,
	Zc_LobbyPlayedLevelsLiveDocument,
	variables,
)
const levels = computed(() => data.value?.lobbyPlayedLevels?.nodes ?? [])
const page = computed(() => mapLobbyPage(data.value?.lobbyPlayedLevels?.pageInfo))
</script>

<template>
	<section class="space-y-4" aria-labelledby="lobby-played-levels">
		<h2 id="lobby-played-levels" class="text-xl font-semibold">{{ t('lobby.analytics.levelsPlayedLabel') }}</h2>
		<DataState :pending="fetching && !data" :error="!data ? error?.message : null" :empty="!!data && !levels.length" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('lobby.analytics.noObservedLevels')">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<WorkshopCard
					v-for="level in levels"
					:key="JSON.stringify([level.levelUid, level.workshopId])"
					:workshop="{
						workshopId: String(level.workshopId),
						name: level.name ?? t('common.unavailable'),
						authorName: level.authorName ?? null,
						imageUrl: level.imageUrl ?? null,
					}"
					:to="level.xxHash ? `/level/${level.xxHash}` : undefined"
					compact
				/>
			</div>
		</DataState>
		<WorkshopPagination :page="page" :pagination="pagination" :pending="fetching" />
	</section>
</template>
