<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ labels.position }}</th>
					<th class="px-4 py-3">{{ labels.player }}</th>
					<th v-if="showTime" class="px-4 py-3">{{ labels.time }}</th>
					<th class="px-4 py-3">{{ labels.points }}</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="row in standings"
					:key="row.userId"
					class="border-t border-border transition-colors hover:bg-primary/8"
					:class="[
						viewerUserId === row.userId ? 'bg-primary/10 text-highlighted' : 'bg-card/60',
						row.pinned ? 'border-t-2 border-primary/40' : '',
					]"
				>
					<td class="px-4 py-3 font-black">
						<span v-if="row.pinned" class="sr-only">{{ labels.yourStanding }}</span>
						#{{ row.position }}
					</td>
					<td class="px-4 py-3">
						<NuxtLink
							v-if="row.steamId"
							:to="`/user/${row.steamId}`"
							class="font-semibold hover:text-primary"
						>
							{{ row.steamName ?? row.steamId }}
						</NuxtLink>
						<span v-else>{{ labels.unknown }}</span>
					</td>
					<td v-if="showTime" class="px-4 py-3 tabular-nums">
						{{ row.time == null ? '—' : formatTime(row.time) }}
					</td>
					<td class="px-4 py-3 tabular-nums">{{ row.points }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup lang="ts">
import type { ZslStanding } from '~/types/app'

withDefaults(
	defineProps<{
		standings: ZslStanding[]
		showTime?: boolean
		viewerUserId?: number
		labels: {
			position: string
			player: string
			time: string
			points: string
			unknown: string
			yourStanding: string
		}
	}>(),
	{ showTime: false },
)

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
