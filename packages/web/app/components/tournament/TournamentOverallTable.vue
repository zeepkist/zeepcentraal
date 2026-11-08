<script setup lang="ts">
import type { SupporterMap } from '~/utils/supporters'
import type { TournamentOverallStanding } from '~/utils/tournamentOverall'

defineProps<{ standings: TournamentOverallStanding[]; viewerUserId?: number; supporters?: SupporterMap }>()
const { locale, t } = useAppI18n()
const number = computed(() => getNumberFormatter(locale.value))
const playerName = (row: TournamentOverallStanding) => String(row.user?.steamName ?? row.user?.steamId ?? t('tournaments.unknownPlayer'))
</script>

<template>
	<DataTableFrame>
		<table class="w-full min-w-[28rem] table-fixed text-left text-sm">
			<colgroup><col class="w-20" /><col /><col class="w-24" /><col class="w-28" /></colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ t('tournaments.rank') }}</th>
					<th class="px-4 py-3">{{ t('tournaments.player') }}</th>
					<th class="px-4 py-3 text-right">{{ t('tournaments.overall.events') }}</th>
					<th class="px-4 py-3 text-right">{{ t('tournaments.points') }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow v-for="row in standings" :key="row.userId" :viewer="row.userId === viewerUserId" :pinned="row.pinned">
					<td class="px-4 py-3 font-bold tabular-nums">#{{ number.format(row.rank) }}</td>
					<td class="p-0">
						<DataTableCellLink :to="row.user?.steamId != null ? `/user/${row.user.steamId}` : undefined" :aria-label="playerName(row)" focusable class="px-4 py-3 font-semibold hover:text-primary">
							<span class="flex min-w-0 items-center whitespace-nowrap">
								<span class="min-w-0 truncate">{{ playerName(row) }}</span>
								<SupporterBadge :supporter="supporters?.[row.userId]" />
								<UBadge v-if="row.pinned" class="ml-2 shrink-0" size="sm" variant="soft">{{ t('tournaments.yourStanding') }}</UBadge>
							</span>
						</DataTableCellLink>
					</td>
					<td class="px-4 py-3 text-right tabular-nums">{{ number.format(row.eventsPlayed) }}</td>
					<td class="px-4 py-3 text-right font-bold tabular-nums">{{ number.format(row.totalPoints) }}</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>
