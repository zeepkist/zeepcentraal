<script setup lang="ts">
import type { AdventureStanding } from '~/utils/adventureLeaderboard'
import { formatAdventureTime } from '~/utils/adventureLeaderboard'
import type { SupporterMap } from '~/utils/supporters'

defineProps<{ entries: AdventureStanding[]; viewerId?: number; supporters?: SupporterMap; expandedUserId?: number; series?: string }>()
defineEmits<{ toggle: [userId: number] }>()
const { t, locale } = useAppI18n()
const number = computed(() => getNumberFormatter(locale.value))
</script>

<template>
	<DataTableFrame>
		<table class="w-full min-w-[42rem] table-fixed text-left text-sm">
			<colgroup><col class="w-10" /><col class="w-20" /><col /><col class="w-24" /><col class="w-40" /><col class="w-24" /></colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th scope="col"><span class="sr-only">{{ t('adventure.leaderboard.levelTimes') }}</span></th>
					<th scope="col" class="px-4 py-3">{{ t('adventure.leaderboard.rank') }}</th>
					<th scope="col" class="px-4 py-3">{{ t('adventure.leaderboard.player') }}</th>
					<th scope="col" class="px-4 py-3 text-right">{{ t('adventure.leaderboard.completed') }}</th>
					<th scope="col" class="px-4 py-3 text-right">{{ t('adventure.leaderboard.totalTime') }}</th>
					<th scope="col" class="px-4 py-3 text-right">{{ t('adventure.leaderboard.remaining') }}</th>
				</tr>
			</thead>
			<tbody>
				<template v-for="entry in entries" :key="entry.userId">
					<DataTableRow :viewer="entry.userId === viewerId" :pinned="entry.pinned" :data-adventure-player="entry.userId">
						<td class="pl-2"><UButton color="neutral" variant="ghost" size="sm" :aria-expanded="expandedUserId === entry.userId" :aria-controls="`adventure-player-${entry.userId}-levels`" :aria-label="t(expandedUserId === entry.userId ? 'adventure.leaderboard.hideLevels' : 'adventure.leaderboard.showLevels', { player: entry.user?.steamName ?? entry.user?.steamId })" @click="$emit('toggle', entry.userId)"><TablerIcon name="chevron-right" class="size-4" :class="expandedUserId === entry.userId ? 'rotate-90' : undefined" /></UButton></td>
						<td class="px-4 py-3 font-bold tabular-nums">#{{ number.format(entry.rank ?? 0) }}</td>
						<td class="p-0">
							<DataTableCellLink :to="entry.user ? `/user/${entry.user.steamId}` : undefined" focusable class="px-4 py-3 font-semibold hover:text-primary">
								<span class="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
									<span class="min-w-0 truncate">{{ entry.user?.steamName ?? entry.user?.steamId }}</span>
									<SupporterBadge :supporter="supporters?.[entry.userId]" class="ml-0" />
									<UBadge v-if="entry.userId === viewerId" class="shrink-0" size="sm" variant="soft">{{ t('adventure.leaderboard.you') }}</UBadge>
								</span>
							</DataTableCellLink>
						</td>
						<td class="px-4 py-3 text-right tabular-nums" :class="entry.isComplete ? 'font-semibold text-foreground' : 'text-muted-foreground'">{{ entry.completedLevels }}/{{ entry.totalLevels }}</td>
						<td class="px-4 py-3 text-right tabular-nums"><span class="font-semibold">{{ formatAdventureTime(entry.totalTimeMs) }}</span><span v-if="!entry.isComplete" class="ml-1 text-xs text-muted-foreground">{{ t('adventure.leaderboard.partial') }}</span></td>
						<td class="px-4 py-3 text-right tabular-nums text-muted-foreground">{{ number.format(entry.remainingLevels ?? 0) }}</td>
					</DataTableRow>
					<tr v-if="expandedUserId === entry.userId" :id="`adventure-player-${entry.userId}-levels`" class="border-t border-border bg-muted/20">
						<td colspan="6"><AdventurePlayerLevels :key="`${series ?? 'all'}:${entry.userId}`" :series="series" :player-id="entry.userId" /></td>
					</tr>
				</template>
			</tbody>
		</table>
	</DataTableFrame>
</template>
