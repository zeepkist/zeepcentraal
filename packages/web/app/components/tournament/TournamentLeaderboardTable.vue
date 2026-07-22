<template>
	<DataTableFrame>
		<table class="w-full min-w-[54rem] table-fixed text-left text-sm">
			<colgroup><col class="w-20" /><col /><col class="w-32" /><col class="w-28" /><col class="w-28" /><col class="w-48" /></colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr><th class="px-4 py-3">{{ $t('tournaments.rank') }}</th><th class="px-4 py-3">{{ $t('tournaments.player') }}</th><th class="px-4 py-3">{{ $t('tournaments.time') }}</th><th class="px-4 py-3">{{ $t('tournaments.delta') }}</th><th class="px-4 py-3">{{ $t('tournaments.points') }}</th><th class="px-4 py-3 text-right">{{ $t('common.set') }}</th></tr>
			</thead>
			<tbody>
				<DataTableRow v-for="row in standings" :key="row.userId" :viewer="viewerUserId === row.userId" :pinned="row.pinned" interactive>
					<td class="p-0 font-black tabular-nums"><DataTableCellLink :to="recordPath(row)" class="px-4 py-3">#{{ row.rank }}</DataTableCellLink></td>
					<td class="p-0"><DataTableCellLink :to="playerPath(row)" focusable class="truncate px-4 py-3 font-semibold group-hover:text-primary">{{ row.steamName ?? row.steamId ?? $t('tournaments.unknownPlayer') }} <UBadge v-if="row.pinned" class="ml-2" size="sm" variant="soft">{{ $t('tournaments.yourStanding') }}</UBadge></DataTableCellLink></td>
					<td class="p-0 font-semibold tabular-nums"><DataTableCellLink :to="recordPath(row)" class="px-4 py-3">{{ formatTournamentTime(row.time) }}</DataTableCellLink></td>
					<td class="p-0 tabular-nums text-muted"><DataTableCellLink :to="recordPath(row)" class="px-4 py-3">{{ fastestTime === undefined ? '—' : (formatTournamentDelta(row.time, fastestTime) ?? '—') }}</DataTableCellLink></td>
					<td class="p-0 font-bold tabular-nums"><DataTableCellLink :to="recordPath(row)" class="px-4 py-3">{{ number.format(row.points) }}</DataTableCellLink></td>
					<td class="p-0 tabular-nums"><DataTableCellLink :to="recordPath(row)" class="px-4 py-3 text-right"><template v-if="row.setAt"><NuxtTime v-if="active" :datetime="row.setAt" relative /><NuxtTime v-else :datetime="row.setAt" date-style="medium" time-style="short" /></template><template v-else>{{ $t('common.unavailable') }}</template></DataTableCellLink></td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup lang="ts">
import type { TournamentStanding } from '~/types/tournament'
import { formatTournamentDelta, formatTournamentTime } from '~/utils/tournament'

defineProps<{
	standings: TournamentStanding[]
	viewerUserId?: number
	fastestTime?: number
	active: boolean
}>()
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const recordPath = (row: TournamentStanding) => `/record/${row.recordId}`
const playerPath = (row: TournamentStanding) => row.steamId ? `/user/${row.steamId}` : recordPath(row)
</script>
