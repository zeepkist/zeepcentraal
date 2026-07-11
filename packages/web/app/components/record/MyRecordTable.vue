<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full min-w-3xl text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ labels.level }}</th>
					<th class="px-4 py-3">{{ labels.rank }}</th>
					<th class="px-4 py-3">{{ labels.time }}</th>
					<th class="px-4 py-3">{{ labels.points }}</th>
					<th class="px-4 py-3">{{ labels.date }}</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="record in records"
					:key="record.id"
					class="group cursor-pointer border-t border-border bg-card/60 transition hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
					tabindex="0"
					:aria-label="labels.openRecord.replace('{level}', record.levelName ?? record.levelXxHash ?? '')"
					@click="$emit('select', record.id)"
					@keydown.enter.prevent="$emit('select', record.id)"
					@keydown.space.prevent="$emit('select', record.id)"
				>
					<td class="px-4 py-3">
						<NuxtLink
							v-if="record.levelXxHash"
							:to="`/level/${record.levelXxHash}`"
							class="font-bold hover:text-primary"
							@click.stop
							@keydown.stop
						>
							{{ record.levelName ?? record.levelXxHash }}
						</NuxtLink>
					</td>
					<td class="px-4 py-3 font-bold tabular-nums">
						<span v-if="record.rank">#{{ number.format(record.rank) }}</span>
						<span v-else class="text-muted-foreground">{{ labels.notRanked }}</span>
					</td>
					<td class="px-4 py-3 font-semibold tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 tabular-nums">
						<template v-if="record.rankedPoints != null">
							<p class="font-bold">{{ number.format(record.rankedPoints) }}</p>
							<p
								v-if="record.nonDecayedPoints != null"
								class="text-xs text-muted-foreground/70"
							>
								{{ labels.nonDecayed.replace('{points}', number.format(record.nonDecayedPoints)) }}
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
import type { RecordRow } from '~/types/app'

defineProps<{
	records: RecordRow[]
	labels: {
		level: string
		rank: string
		time: string
		points: string
		date: string
		notRanked: string
		nonDecayed: string
		openRecord: string
	}
}>()

defineEmits<{ select: [recordId: number] }>()

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
