<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full min-w-[56rem] table-fixed text-left text-sm">
			<colgroup>
				<col />
				<col class="w-[6rem]" />
				<col class="w-[7rem]" />
				<col class="w-[8rem]" />
				<col class="w-[8rem]" />
				<col class="w-[9rem]" />
			</colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3" scope="col">{{ labels.level }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.rank }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.time }}</th>
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
					<td class="px-4 py-3 font-bold tabular-nums">
						<span v-if="record.levelPosition != null">
							#{{ number.format(record.levelPosition) }}
						</span>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="px-4 py-3 font-semibold tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 tabular-nums">
						<template v-if="record.levelDecayedPoints != null">
							<p class="font-bold">{{ number.format(record.levelDecayedPoints) }}</p>
							<p
								v-if="record.levelDecayMultiplier != null"
								class="text-xs text-muted-foreground/70"
								:aria-label="
									labels.decayPercentage.replace(
										'{percentage}',
										percentage.format(record.levelDecayMultiplier),
									)
								"
							>
								{{ percentage.format(record.levelDecayMultiplier) }}
							</p>
						</template>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="px-4 py-3 tabular-nums">
						<template v-if="record.playerDecayedPoints != null">
							<p class="font-bold">{{ number.format(record.playerDecayedPoints) }}</p>
							<p
								v-if="record.globalDecayMultiplier != null"
								class="text-xs text-muted-foreground/70"
								:aria-label="
									labels.decayPercentage.replace(
										'{percentage}',
										percentage.format(record.globalDecayMultiplier),
									)
								"
							>
								{{ percentage.format(record.globalDecayMultiplier) }}
							</p>
						</template>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="px-4 py-3 text-muted-foreground">
						<NuxtTime :datetime="record.dateCreated" relative />
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup lang="ts">
import type { MyRecordRow } from '~/types/app'
import { createDecayPercentageFormatter } from '~/utils/decayPercentage'

defineProps<{
	records: MyRecordRow[]
	labels: {
		level: string
		rank: string
		time: string
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
const percentage = computed(() => createDecayPercentageFormatter(locale.value))

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
