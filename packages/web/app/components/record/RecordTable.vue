<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ rankLabel }}</th>
					<th class="px-4 py-3">{{ userLabel }}</th>
					<th v-if="showLevel" class="px-4 py-3">{{ levelLabel }}</th>
					<th class="px-4 py-3">{{ timeLabel }}</th>
					<th class="px-4 py-3">{{ dateLabel }}</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="(record, index) in records"
					:key="record.id"
					class="border-t border-border"
					:class="record.viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60'"
				>
					<td class="px-4 py-3 tabular-nums">{{ record.rank ?? index + 1 }}</td>
					<td class="px-4 py-3">
						<NuxtLink v-if="record.userSteamId" :to="`/user/${record.userSteamId}`" class="font-medium hover:text-primary">
							{{ record.userName ?? record.userSteamId }}
						</NuxtLink>
						<span v-else>{{ record.userName }}</span>
					</td>
					<td v-if="showLevel" class="px-4 py-3">
						<NuxtLink v-if="record.levelXxHash" :to="`/level/${record.levelXxHash}`" class="hover:text-primary">
							{{ record.levelName ?? record.levelXxHash }}
						</NuxtLink>
					</td>
					<td class="px-4 py-3 font-semibold tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 text-muted-foreground"><NuxtTime :datetime="record.dateCreated" relative /></td>
				</tr>
			</tbody>
		</table>
	</div>
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
	}>(),
	{ showLevel: false },
)

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
