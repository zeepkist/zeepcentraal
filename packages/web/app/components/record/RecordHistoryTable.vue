<template>
	<DataTableFrame>
		<span class="sr-only" aria-live="polite">
			{{ highlightedRecordIds?.size ? liveUpdateLabel : '' }}
		</span>
		<table
			class="w-full table-fixed text-left text-sm"
			:class="showPlayer ? 'min-w-[75rem]' : 'min-w-[64rem]'"
		>
			<colgroup>
				<col />
				<col v-if="showPlayer" class="w-[11rem]" />
				<col class="w-[6rem]" />
				<col class="w-[7rem]" />
				<col class="w-[8rem]" />
				<col class="w-[8rem]" />
				<col class="w-[8rem]" />
				<col class="w-[9rem]" />
			</colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3" scope="col">{{ labels.level }}</th>
					<th v-if="showPlayer" class="px-4 py-3" scope="col">{{ labels.player }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.rank }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.time }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.levelPoints }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.points }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.rankedPoints }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.date }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow
					v-for="record in records"
					:key="record.id"
					:viewer="viewerUserId === record.userId"
					:highlighted="highlightedRecordIds?.has(record.id)"
					interactive
				>
					<td class="p-0">
						<DataTableCellLink
							:to="levelPath(record)"
							focusable
							class="truncate px-4 py-3 font-bold group-hover:text-primary"
						>
							{{ record.levelName }}
						</DataTableCellLink>
					</td>
					<td v-if="showPlayer" class="p-0">
						<DataTableCellLink
							:to="playerOrRecordPath(record)"
							:focusable="Boolean(record.userSteamId)"
							:aria-label="record.userSteamId ? undefined : recordAriaLabel(record)"
							class="truncate px-4 py-3 font-semibold group-hover:text-primary"
						>
							<span :class="record.userSteamId ? '' : 'text-muted-foreground'">
								{{ record.userName ?? record.userSteamId ?? labels.unknownPlayer }}
							</span>
						</DataTableCellLink>
					</td>
					<td class="p-0 font-bold tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)" class="px-4 py-3">
							<span v-if="record.levelPosition != null">
								#{{ number.format(record.levelPosition) }}
							</span>
							<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
						</DataTableCellLink>
					</td>
					<td class="p-0 font-semibold tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)" focusable class="px-4 py-3">
							{{ formatTime(record.time) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 font-bold tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)" class="px-4 py-3">
							<span v-if="record.levelPoints != null">{{ number.format(record.levelPoints) }}</span>
							<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
						</DataTableCellLink>
					</td>
					<td class="p-0">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)">
							<RecordPointValue
								:points="record.levelDecayedPoints"
								:decay-multiplier="record.levelDecayMultiplier"
								:not-ranked-label="labels.notRanked"
								:decay-label="labels.decayPercentage"
							/>
						</DataTableCellLink>
					</td>
					<td class="p-0">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)">
							<RecordPointValue
								:points="record.playerDecayedPoints"
								:decay-multiplier="record.globalDecayMultiplier"
								:not-ranked-label="labels.notRanked"
								:decay-label="labels.decayPercentage"
							/>
						</DataTableCellLink>
					</td>
					<td class="p-0 text-muted-foreground">
						<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)" class="px-4 py-3">
							<NuxtTime
								:datetime="record.dateCreated"
								relative
								numeric="auto"
								relative-style="short"
							/>
						</DataTableCellLink>
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup lang="ts">
import type { RecordHistoryRow } from '~/types/app'

const props = defineProps<{
	records: RecordHistoryRow[]
	highlightedRecordIds?: ReadonlySet<number>
	liveUpdateLabel: string
	showPlayer?: boolean
	viewerUserId?: number
	labels: {
		level: string
		player: string
		unknownPlayer: string
		rank: string
		time: string
		levelPoints: string
		points: string
		rankedPoints: string
		date: string
		notRanked: string
		decayPercentage: string
		openRecord: string
	}
}>()

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

function recordPath(record: RecordHistoryRow) {
	return `/record/${record.id}`
}

function levelPath(record: RecordHistoryRow) {
	return `/level/${record.levelXxHash}`
}

function playerOrRecordPath(record: RecordHistoryRow) {
	return record.userSteamId ? `/user/${record.userSteamId}` : recordPath(record)
}

function recordAriaLabel(record: RecordHistoryRow) {
	return props.labels.openRecord.replace('{level}', record.levelName)
}
</script>
