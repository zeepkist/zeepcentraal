<template>
	<DataTableFrame>
		<table
			class="w-full table-fixed text-left text-sm"
			:class="tableWidthClass"
		>
			<colgroup>
				<col class="w-[7rem]" />
				<col />
				<col v-if="showTime" class="w-[9rem]" />
				<col v-if="showLevelsPlayed" class="w-[9rem]" />
				<col v-for="label in roundLabels" :key="label" class="w-[5.5rem]" />
				<col class="w-[8rem]" />
			</colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3" scope="col">{{ labels.position }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.player }}</th>
					<th v-if="showTime" class="px-4 py-3" scope="col">{{ labels.time }}</th>
					<th v-if="showLevelsPlayed" class="px-4 py-3" scope="col">
						{{ labels.levelsPlayed }}
					</th>
					<th v-for="label in roundLabels" :key="label" class="px-4 py-3" scope="col">
						{{ label }}
					</th>
					<th class="px-4 py-3" scope="col">{{ labels.points }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow
					v-for="row in standings"
					:key="row.userId"
					:viewer="viewerUserId === row.userId"
					:pinned="row.pinned"
					:interactive="Boolean(row.steamId)"
				>
					<td class="p-0 font-black tabular-nums">
						<DataTableCellLink
							:to="userPath(row.steamId)"
							:aria-label="labels.openPlayer"
							class="px-4 py-3"
						>
							#{{ number.format(row.position) }}
						</DataTableCellLink>
					</td>
					<td class="p-0">
						<DataTableCellLink
							:to="userPath(row.steamId)"
							focusable
							class="flex min-w-0 items-center gap-2 px-4 py-3"
						>
							<span v-if="row.steamId" class="truncate font-semibold group-hover:text-primary">
								{{ row.steamName ?? row.steamId }}
							</span>
							<span v-else class="truncate text-muted-foreground">{{ labels.unknown }}</span>
							<UBadge v-if="row.pinned" color="primary" variant="soft" size="sm">
								{{ labels.yourStanding }}
							</UBadge>
						</DataTableCellLink>
					</td>
					<td v-if="showTime" class="p-0 font-semibold tabular-nums">
						<DataTableCellLink :to="userPath(row.steamId)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ row.time == null ? labels.emptyValue : formatTime(row.time) }}
						</DataTableCellLink>
					</td>
					<td v-if="showLevelsPlayed" class="p-0 font-semibold tabular-nums">
						<DataTableCellLink :to="userPath(row.steamId)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ row.levelsPlayed == null ? labels.emptyValue : number.format(row.levelsPlayed) }}
						</DataTableCellLink>
					</td>
					<td
						v-for="(_, index) in roundLabels"
						:key="index"
						class="p-0 font-semibold tabular-nums"
					>
						<DataTableCellLink :to="userPath(row.steamId)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{
								row.roundPoints?.[index] == null
									? labels.emptyValue
									: number.format(row.roundPoints[index] ?? 0)
							}}
						</DataTableCellLink>
					</td>
					<td class="p-0 font-bold tabular-nums">
						<DataTableCellLink :to="userPath(row.steamId)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ number.format(row.points) }}
						</DataTableCellLink>
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup vapor lang="ts">
import type { ZslStanding } from '~/types/app'

const props = withDefaults(
	defineProps<{
		standings: ZslStanding[]
		showTime?: boolean
		showLevelsPlayed?: boolean
		roundLabels?: string[]
		viewerUserId?: number
		labels: {
			position: string
			player: string
			time: string
			points: string
			levelsPlayed: string
			openPlayer: string
			unknown: string
			yourStanding: string
			emptyValue: string
		}
	}>(),
	{ roundLabels: () => [], showLevelsPlayed: false, showTime: false },
)

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const tableWidthClass = computed(() => {
	if (props.roundLabels.length > 0) return 'min-w-[68rem]'
	if (props.showLevelsPlayed) return 'min-w-[42rem]'
	return props.showTime ? 'min-w-[40rem]' : 'min-w-[32rem]'
})

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

function userPath(steamId?: string | null) {
	return steamId ? `/user/${steamId}` : undefined
}
</script>
