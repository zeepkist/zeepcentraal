<script setup lang="ts">
import type { Zc_AdventureStandingFragment } from '@zeepkist/graphql/generated'
import { formatAdventureTime } from '~/utils/adventureLeaderboard'

defineProps<{ entries: Zc_AdventureStandingFragment[]; viewerId?: number }>()
const { t } = useAppI18n()
const columns = computed(() => [t('adventure.leaderboard.rank'), t('adventure.leaderboard.player'), t('adventure.leaderboard.completed'), t('adventure.leaderboard.totalTime'), t('adventure.leaderboard.remaining')])
</script>

<template>
	<DataTableFrame>
		<table class="w-full min-w-[36rem] text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th v-for="column in columns" :key="column" scope="col" class="px-4 py-3">{{ column }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow v-for="entry in entries" :key="entry.userId" :viewer="entry.userId === viewerId">
					<td class="px-4 py-3 font-bold tabular-nums">#{{ entry.rank }}</td>
					<td class="max-w-64 px-4 py-3">
						<NuxtLink v-if="entry.user" :to="`/user/${entry.user.steamId}`" class="flex items-center gap-2 font-semibold hover:text-primary">
							<UAvatar :alt="entry.user.steamName ?? String(entry.user.steamId)" size="xs" />
							<span class="truncate">{{ entry.user.steamName ?? entry.user.steamId }}</span>
						</NuxtLink>
					</td>
					<td class="px-4 py-3 tabular-nums"><UBadge :color="entry.isComplete ? 'success' : 'neutral'" variant="soft">{{ entry.completedLevels }}/{{ entry.totalLevels }}</UBadge></td>
					<td class="px-4 py-3 tabular-nums">{{ formatAdventureTime(entry.totalTimeMs) }} <span v-if="!entry.isComplete" class="text-xs text-muted">{{ t('adventure.leaderboard.partial') }}</span></td>
					<td class="px-4 py-3 tabular-nums">{{ entry.remainingLevels }}</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>
