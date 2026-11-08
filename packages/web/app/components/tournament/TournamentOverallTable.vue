<script setup lang="ts">
import type { SupporterMap } from '~/utils/supporters'
import type { TournamentOverallStanding } from '~/utils/tournamentOverall'

defineProps<{ standings: TournamentOverallStanding[]; viewerUserId?: number; supporters?: SupporterMap }>()
const { locale, t } = useAppI18n()
const number = computed(() => getNumberFormatter(locale.value))
</script>

<template>
	<DataTableFrame>
		<table class="w-full min-w-[28rem] text-left text-sm">
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
					<td class="max-w-48 px-4 py-3">
						<NuxtLink v-if="row.user?.steamId != null" :to="`/user/${row.user.steamId}`" class="block truncate font-semibold hover:text-primary">{{ row.user.steamName ?? row.user.steamId }}</NuxtLink>
						<span v-else>{{ row.user?.steamName ?? t('tournaments.unknownPlayer') }}</span>
						<SupporterBadge :supporter="supporters?.[row.userId]" />
						<UBadge v-if="row.pinned" class="mt-1" size="sm" variant="soft">{{ t('tournaments.yourStanding') }}</UBadge>
					</td>
					<td class="px-4 py-3 text-right tabular-nums">{{ number.format(row.eventsPlayed) }}</td>
					<td class="px-4 py-3 text-right font-bold tabular-nums">{{ number.format(row.totalPoints) }}</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>
