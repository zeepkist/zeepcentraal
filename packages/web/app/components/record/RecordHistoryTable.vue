<template>
	<div class="overflow-x-auto rounded-xl border border-border">
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
				<tr
					v-for="record in records"
					:key="record.id"
					class="group cursor-pointer border-t border-border bg-card/60 transition hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
					:class="{ 'record-history-highlight': highlightedRecordIds?.has(record.id) }"
					tabindex="0"
					:aria-label="labels.openRecord.replace('{level}', record.levelName)"
					@click="$emit('select', record.id)"
					@keydown.enter.prevent="$emit('select', record.id)"
					@keydown.space.prevent="$emit('select', record.id)"
				>
					<td class="px-4 py-3">
						<NuxtLink
							:to="`/level/${record.levelXxHash}`"
							class="block truncate font-bold hover:text-primary"
							@click.stop
							@keydown.stop
						>
							{{ record.levelName }}
						</NuxtLink>
					</td>
					<td v-if="showPlayer" class="px-4 py-3">
						<NuxtLink
							v-if="record.userSteamId"
							:to="`/user/${record.userSteamId}`"
							class="block truncate font-semibold hover:text-primary"
							@click.stop
							@keydown.stop
						>
							{{ record.userName ?? record.userSteamId }}
						</NuxtLink>
						<span v-else class="block truncate text-muted-foreground">
							{{ record.userName ?? labels.unknownPlayer }}
						</span>
					</td>
					<td class="px-4 py-3 font-bold tabular-nums">
						<span v-if="record.levelPosition != null">
							#{{ number.format(record.levelPosition) }}
						</span>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="px-4 py-3 font-semibold tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 font-bold tabular-nums">
						<span v-if="record.levelPoints != null">{{ number.format(record.levelPoints) }}</span>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="p-0">
						<RecordPointValue
							:points="record.levelDecayedPoints"
							:decay-multiplier="record.levelDecayMultiplier"
							:not-ranked-label="labels.notRanked"
							:decay-label="labels.decayPercentage"
						/>
					</td>
					<td class="p-0">
						<RecordPointValue
							:points="record.playerDecayedPoints"
							:decay-multiplier="record.globalDecayMultiplier"
							:not-ranked-label="labels.notRanked"
							:decay-label="labels.decayPercentage"
						/>
					</td>
					<td class="px-4 py-3 text-muted-foreground">
						<NuxtTime
							:datetime="record.dateCreated"
							relative
							numeric="auto"
							relative-style="short"
						/>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup lang="ts">
import type { RecordHistoryRow } from '~/types/app'

defineProps<{
	records: RecordHistoryRow[]
	highlightedRecordIds?: ReadonlySet<number>
	liveUpdateLabel: string
	showPlayer?: boolean
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

defineEmits<{ select: [recordId: number] }>()

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
