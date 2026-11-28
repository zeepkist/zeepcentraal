<script setup lang="ts">
import type { Zc_LobbyStatisticsQuery } from '@zeepkist/graphql/generated'
import { rankLobbyLevelActivity } from '~/utils/lobbyLevelActivity'

const props = defineProps<{
	maps: Zc_LobbyStatisticsQuery['popularMaps']
	mappers: Zc_LobbyStatisticsQuery['popularMappers']
	pending: boolean
	now: Date
}>()
const { t } = useAppI18n()
const { number, mounted } = useLobbyFormat()
const initialTime = useState('lobby-level-activity-time', () => Date.now())
const now = computed(() => mounted.value ? props.now.getTime() : initialTime.value)
const rankings = computed(() => [
	{ key: 'maps', title: t('lobby.analytics.popularMaps'), path: '/workshop/', rows: rankLobbyLevelActivity(props.maps?.nodes ?? [], 'workshop', now.value) },
	{ key: 'mappers', title: t('lobby.analytics.popularMappers'), path: '/user/', rows: rankLobbyLevelActivity(props.mappers?.nodes ?? [], 'author', now.value) },
])
</script>

<template>
	<div class="space-y-3" :aria-busy="pending">
		<template v-if="maps || mappers">
			<p v-if="maps?.pageInfo.hasNextPage || mappers?.pageInfo.hasNextPage" class="text-sm text-muted-foreground">{{ t('lobby.analytics.activityRankingSample') }}</p>
			<div class="grid gap-4 lg:grid-cols-2">
				<section v-for="ranking in rankings" :key="ranking.key" class="flex min-w-0 flex-col gap-2" :aria-labelledby="`lobby-level-${ranking.key}`">
					<h2 :id="`lobby-level-${ranking.key}`" class="text-xl font-semibold">{{ ranking.title }}</h2>
					<UEmpty
						v-if="!ranking.rows.length"
						class="grow rounded-xl sm:p-4 lg:p-4"
						:description="t(ranking.key === 'maps' ? 'lobby.analytics.activityNoMaps' : 'lobby.analytics.activityNoMappers')"
					/>
					<DataTableFrame v-else class="grow">
						<table :aria-labelledby="`lobby-level-${ranking.key}`" class="w-full table-fixed text-left text-sm">
							<thead><tr>
								<th scope="col" class="w-1/2 px-3 py-2">{{ t(ranking.key === 'maps' ? 'lobby.analytics.level' : 'lobby.analytics.levelAuthor') }}</th>
								<th scope="col" class="px-3 py-2 text-right">{{ t('lobby.analytics.activityRooms') }}</th>
								<th scope="col" class="px-3 py-2 text-right">{{ t('lobby.analytics.activityPlayersNow') }}</th>
							</tr></thead>
							<tbody>
								<DataTableRow v-for="row in ranking.rows" :key="row.id">
									<td class="break-words px-3 py-2"><NuxtLink :to="`${ranking.path}${row.id}`" class="text-primary hover:underline">{{ row.name || row.id }}</NuxtLink></td>
									<td class="px-3 py-2 text-right tabular-nums">{{ number(row.rooms) }}</td>
									<td class="px-3 py-2 text-right tabular-nums">{{ number(row.players) }}</td>
								</DataTableRow>
							</tbody>
						</table>
					</DataTableFrame>
				</section>
			</div>
		</template>
	</div>
</template>
