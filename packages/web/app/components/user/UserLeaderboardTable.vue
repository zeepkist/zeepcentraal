<template>
	<div class="overflow-x-auto rounded-xl border border-border">
		<table class="w-full text-left text-sm">
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3">{{ labels.rank }}</th>
					<th class="px-4 py-3">{{ labels.player }}</th>
					<th class="px-4 py-3">{{ labels.points }}</th>
					<th class="px-4 py-3">{{ labels.totalPoints }}</th>
					<th class="px-4 py-3">{{ labels.worldRecords }}</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="user in users" :key="user.id" class="border-t border-border bg-card/60 transition-colors hover:bg-primary/5">
					<td class="px-4 py-3 font-bold tabular-nums">#{{ user.rank ?? '—' }}</td>
					<td class="px-4 py-3"><NuxtLink :to="`/user/${user.steamId}`" class="font-semibold hover:text-primary">{{ user.steamName }}</NuxtLink></td>
					<td class="px-4 py-3 tabular-nums">{{ format(user.points) }}</td>
					<td class="px-4 py-3 tabular-nums">{{ format(user.totalPoints) }}</td>
					<td class="px-4 py-3 tabular-nums">{{ format(user.worldRecords) }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script setup lang="ts">
import type { UserSummary } from '~/types/app'

defineProps<{
	users: UserSummary[]
	labels: {
		rank: string
		player: string
		points: string
		totalPoints: string
		worldRecords: string
	}
}>()
const formatter = new Intl.NumberFormat()
const format = (value?: number | null) => formatter.format(value ?? 0)
</script>
