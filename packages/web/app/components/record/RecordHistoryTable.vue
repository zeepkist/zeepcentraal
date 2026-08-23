<template>
	<DataTableFrame>
		<span class="sr-only" aria-live="polite">
			{{ highlightedRecordIds?.size ? liveUpdateLabel : '' }}
		</span>
		<table class="w-full table-fixed text-left text-sm" :class="tableMinWidth">
			<colgroup>
				<col
					v-for="column in columns"
					:key="column"
					:class="columnWidth(column)"
				/>
			</colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th
						v-for="column in columns"
						:key="column"
						class="px-4 py-3"
						:class="column === 'date' ? 'text-right' : ''"
						scope="col"
					>
						<RecordPointsHeader
							v-if="column === 'points'"
							:label="labels.points"
							:help="labels.pointsHelp"
						/>
						<RecordPointsHeader
							v-else-if="column === 'rankedPoints'"
							:label="labels.rankedPoints"
							:help="labels.rankedPointsHelp"
						/>
						<template v-else>{{ columnLabel(column) }}</template>
					</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow
					v-for="record in records"
					:key="record.id"
					:viewer="viewerUserId === record.userId"
					:pinned="record.pinned"
					:highlighted="highlightedRecordIds?.has(record.id)"
					interactive
				>
					<template v-for="column in columns" :key="column">
						<td v-if="column === 'level'" class="p-0">
							<DataTableCellLink
								:to="levelPath(record)"
								focusable
								class="truncate px-4 py-3 font-bold group-hover:text-primary"
							>
								{{ record.levelName }}
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'player'" class="p-0">
							<DataTableCellLink
								:to="playerOrRecordPath(record)"
								:focusable="Boolean(record.userSteamId)"
								:aria-label="record.userSteamId ? undefined : recordAriaLabel(record)"
								class="truncate px-4 py-3 font-semibold group-hover:text-primary"
							>
								<span
									:class="record.userSteamId ? '' : 'text-muted-foreground'"
									:style="transition.sourceStyle(transitionScope, 'record', record.id, 'title')"
									data-shared-transition-source="title"
								>
									{{ record.userName ?? record.userSteamId ?? labels.unknownPlayer }}
								</span>
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'rank'" class="p-0 font-bold tabular-nums">
							<DataTableCellLink
								:to="recordPath(record)"
								:aria-label="recordAriaLabel(record)"
								class="px-4 py-3"
							>
								<span v-if="record.levelPosition != null">
									#{{ number.format(record.levelPosition) }}
								</span>
								<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'time'" class="p-0 font-semibold tabular-nums">
							<DataTableCellLink
								:to="recordPath(record)"
								:aria-label="recordAriaLabel(record)"
								focusable
								class="px-4 py-3"
								@click.capture="beginTransition($event, record)"
							>
								<span
									:style="transition.sourceStyle(transitionScope, 'record', record.id, 'metric')"
									data-shared-transition-source="metric"
								>
									{{ formatTime(record.time) }}
								</span>
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'delta'" class="p-0 tabular-nums text-muted">
							<DataTableCellLink
								:to="recordPath(record)"
								:aria-label="recordAriaLabel(record)"
								class="px-4 py-3"
							>
								{{
									fastestTime === undefined
										? labels.notRanked
										: (formatTournamentDelta(record.time, fastestTime) ?? labels.notRanked)
								}}
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'status'" class="p-0">
							<DataTableCellLink
								:to="recordPath(record)"
								:aria-label="recordAriaLabel(record)"
								class="px-4 py-3"
							>
								<RecordStatusBadge
									:status="visibleStatus(record)"
									:personal-best-label="labels.personalBest"
									:world-record-label="labels.worldRecord"
								/>
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'points'" class="p-0">
							<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)">
								<RecordPointValue
									:points="record.levelDecayedPoints"
									:decay-multiplier="record.levelDecayMultiplier"
									:not-ranked-label="labels.notRanked"
									:decay-label="labels.decayPercentage"
								/>
							</DataTableCellLink>
						</td>
						<td v-else-if="column === 'rankedPoints'" class="p-0">
							<DataTableCellLink :to="recordPath(record)" :aria-label="recordAriaLabel(record)">
								<RecordPointValue
									:points="record.playerDecayedPoints"
									:decay-multiplier="record.globalDecayMultiplier"
									:not-ranked-label="labels.notRanked"
									:decay-label="labels.decayPercentage"
								/>
							</DataTableCellLink>
						</td>
						<td v-else class="p-0 text-right text-muted-foreground">
							<DataTableCellLink
								:to="recordPath(record)"
								:aria-label="recordAriaLabel(record)"
								class="px-4 py-3"
							>
								<RecordDate :datetime="record.dateCreated" />
							</DataTableCellLink>
						</td>
					</template>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup vapor lang="ts">
import type { RecordHistoryRow } from '~/types/app'
import {
	getRecordHistoryColumns,
	type RecordHistoryColumn,
} from '~/utils/recordHistoryColumns'
import { formatTournamentDelta } from '~/utils/tournament'

const props = withDefaults(
	defineProps<{
		records: RecordHistoryRow[]
		transitionScope: string
		highlightedRecordIds?: ReadonlySet<number>
		liveUpdateLabel: string
		showLevel?: boolean
		showPlayer?: boolean
		rankFirst?: boolean
		showDelta?: boolean
		fastestTime?: number
		viewerUserId?: number
		statusMode?: 'none' | 'world-record-only' | 'all'
		labels: {
			level: string
			player: string
			unknownPlayer: string
			rank: string
			time: string
			delta: string
			status: string
			personalBest: string
			worldRecord: string
			levelPoints: string
			points: string
			pointsHelp?: string
			rankedPoints: string
			rankedPointsHelp?: string
			date: string
			notRanked: string
			decayPercentage: string
			openRecord: string
		}
	}>(),
	{
		showLevel: true,
		showPlayer: false,
		rankFirst: false,
		showDelta: false,
		statusMode: 'none',
	},
)

const { locale } = useI18n()
const transition = useSharedViewTransition()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const showStatus = computed(() => props.statusMode !== 'none')
const showDeltaColumn = computed(
	() => props.showDelta && props.fastestTime !== undefined,
)
const columns = computed(() =>
	getRecordHistoryColumns({
		showLevel: props.showLevel,
		showPlayer: props.showPlayer,
		rankFirst: props.rankFirst,
		showStatus: showStatus.value,
		showDelta: showDeltaColumn.value,
	}),
)
const tableMinWidth = computed(() => {
	if (props.showLevel && props.showPlayer) {
		if (showStatus.value) return showDeltaColumn.value ? 'min-w-[70rem]' : 'min-w-[63rem]'
		return showDeltaColumn.value ? 'min-w-[66rem]' : 'min-w-[59rem]'
	}
	if (showStatus.value) return showDeltaColumn.value ? 'min-w-[59rem]' : 'min-w-[52rem]'
	return showDeltaColumn.value ? 'min-w-[55rem]' : 'min-w-[48rem]'
})

function columnWidth(column: RecordHistoryColumn) {
	if (column === 'player' && props.showLevel) return 'w-[11rem]'
	if (column === 'rank') return 'w-[5rem]'
	if (column === 'time') return 'w-[5rem]'
	if (column === 'delta') return 'w-[7rem]'
	if (column === 'status') return 'w-[4rem]'
	if (column === 'points' || column === 'rankedPoints') return 'w-[8rem]'
	if (column === 'date') return 'w-[10rem]'
	return undefined
}

function columnLabel(column: RecordHistoryColumn) {
	if (column === 'level') return props.labels.level
	if (column === 'player') return props.labels.player
	if (column === 'rank') return props.labels.rank
	if (column === 'time') return props.labels.time
	if (column === 'delta') return props.labels.delta
	if (column === 'status') return props.labels.status
	return props.labels.date
}

function visibleStatus(record: RecordHistoryRow) {
	if (props.statusMode === 'all') return record.pbOrWr
	return record.pbOrWr === 'world-record' ? record.pbOrWr : null
}

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

function beginTransition(event: MouseEvent, record: RecordHistoryRow) {
	transition.begin({
		event,
		entity: 'record',
		entityId: record.id,
		scope: props.transitionScope,
		targetRoute: recordPath(record),
		preview: {
			title: record.userName ?? record.userSteamId ?? props.labels.unknownPlayer,
			subtitle: record.levelName,
			metric: formatTime(record.time),
		},
	})
}
</script>
