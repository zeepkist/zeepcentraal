<template>
	<DataTableFrame>
		<table class="w-full text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th v-if="showRank" class="px-4 py-3">{{ rankLabel }}</th>
					<th v-if="showUser" class="px-4 py-3">{{ userLabel }}</th>
					<th v-if="showLevel" class="px-4 py-3">{{ levelLabel }}</th>
					<th v-if="showPoints" class="px-4 py-3">{{ pointsLabel }}</th>
					<th v-if="showPbOrWr" class="px-4 py-3">{{ pbOrWrLabel }}</th>
					<th class="px-4 py-3">{{ timeLabel }}</th>
					<th class="px-4 py-3 text-right">{{ dateLabel }}</th>
				</tr>
			</thead>
			<tbody>
				<DataTableRow
					v-for="(record, index) in records"
					:key="record.id"
					:viewer="record.viewer"
					:pinned="record.pinned"
					interactive
				>
					<td v-if="showRank" class="p-0 tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="openRecordLabel" class="px-4 py-3">
							{{ record.rank ?? index + 1 }}
						</DataTableCellLink>
					</td>
					<td v-if="showUser" class="p-0">
						<DataTableCellLink
							:to="playerOrRecordPath(record)"
							:focusable="Boolean(record.userSteamId)"
							:aria-label="record.userSteamId ? undefined : openRecordLabel"
							class="px-4 py-3 font-medium group-hover:text-primary"
						>
							{{ record.userName ?? record.userSteamId }}
						</DataTableCellLink>
					</td>
					<td v-if="showLevel" class="p-0">
						<DataTableCellLink
							:to="levelOrRecordPath(record)"
							:focusable="Boolean(record.levelXxHash)"
							:aria-label="record.levelXxHash ? undefined : openRecordLabel"
							class="px-4 py-3 group-hover:text-primary"
						>
							{{ record.levelName ?? record.levelXxHash }}
						</DataTableCellLink>
					</td>
					<td v-if="showPoints" class="p-0 font-semibold tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="openRecordLabel" class="px-4 py-3">
							<span v-if="record.points != null">{{ pointNumber.format(record.points) }}</span>
						</DataTableCellLink>
					</td>
					<td v-if="showPbOrWr" class="p-0">
						<DataTableCellLink :to="recordPath(record)" :aria-label="openRecordLabel" class="px-4 py-3">
							<UBadge
								v-if="record.pbOrWr === 'world-record'"
								color="primary"
								variant="soft"
							>
								{{ worldRecordLabel }}
							</UBadge>
							<UBadge
								v-else-if="record.pbOrWr === 'personal-best'"
								color="neutral"
								variant="soft"
								class="bg-purple-500/15 text-purple-700 ring-purple-500/25 dark:bg-purple-400/15 dark:text-purple-300 dark:ring-purple-400/25"
							>
								{{ personalBestLabel }}
							</UBadge>
						</DataTableCellLink>
					</td>
					<td class="p-0 font-semibold tabular-nums">
						<DataTableCellLink :to="recordPath(record)" :aria-label="openRecordLabel" focusable class="px-4 py-3">
							{{ formatTime(record.time) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 text-right text-muted-foreground">
						<DataTableCellLink :to="recordPath(record)" :aria-label="openRecordLabel" class="px-4 py-3">
							<NuxtTime :datetime="record.dateCreated" relative numeric="auto" relative-style="short" />
						</DataTableCellLink>
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup lang="ts">
import type { RecordRow } from '~/types/app'

withDefaults(
	defineProps<{
		records: RecordRow[]
		rankLabel: string
		userLabel: string
		levelLabel: string
		timeLabel: string
		dateLabel: string
		showLevel?: boolean
		showUser?: boolean
		showRank?: boolean
		showPoints?: boolean
		showPbOrWr?: boolean
		pointsLabel?: string
		pbOrWrLabel?: string
		personalBestLabel?: string
		worldRecordLabel?: string
		openRecordLabel: string
	}>(),
	{ showLevel: false, showRank: true, showUser: true },
)

const { locale } = useI18n()
const pointNumber = computed(
	() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }),
)

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}

function recordPath(record: RecordRow) {
	return `/record/${record.id}`
}

function playerOrRecordPath(record: RecordRow) {
	return record.userSteamId ? `/user/${record.userSteamId}` : recordPath(record)
}

function levelOrRecordPath(record: RecordRow) {
	return record.levelXxHash ? `/level/${record.levelXxHash}` : recordPath(record)
}
</script>
