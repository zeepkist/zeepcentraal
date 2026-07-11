<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ labels.rank }}</th>
					<th class="px-4 py-3">{{ labels.level }}</th>
					<th class="px-4 py-3">{{ labels.time }}</th>
					<th class="px-4 py-3">{{ labels.value }}</th>
					<th class="px-4 py-3">{{ labels.date }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="record in records" :key="record.id" class="border-t border-border bg-card/60">
					<td class="px-4 py-3 font-bold tabular-nums">{{ record.rank ? `#${record.rank}` : '—' }}</td>
					<td class="px-4 py-3"><NuxtLink :to="`/level/${record.levelXxHash}`" class="font-semibold hover:text-primary">{{ record.levelName }}</NuxtLink></td>
					<td class="px-4 py-3 tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 tabular-nums">{{ record.value == null ? '—' : formatNumber(record.value) }}</td>
					<td class="px-4 py-3 text-muted-foreground"><NuxtTime :datetime="record.dateCreated" relative /></td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup lang="ts">
import type { RecordRow } from '~/types/app'

defineProps<{
	records: RecordRow[]
	labels: { rank: string; level: string; time: string; value: string; date: string }
}>()
const formatNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format
function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
