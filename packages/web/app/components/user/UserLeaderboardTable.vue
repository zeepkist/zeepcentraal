<template>
	<DataTableFrame>
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
				<DataTableRow
					v-for="user in users"
					:key="user.id"
					:viewer="viewerUserId === user.id"
					interactive
				>
					<td class="p-0 font-bold tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							#{{ user.rank ?? '—' }}
						</DataTableCellLink>
					</td>
					<td class="p-0">
						<DataTableCellLink :to="userPath(user)" focusable class="px-4 py-3 font-semibold group-hover:text-primary">
							{{ user.steamName }}
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.points) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.totalPoints) }}
						</DataTableCellLink>
					</td>
					<td class="p-0 tabular-nums">
						<DataTableCellLink :to="userPath(user)" :aria-label="labels.openPlayer" class="px-4 py-3">
							{{ format(user.worldRecords) }}
						</DataTableCellLink>
					</td>
				</DataTableRow>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup vapor lang="ts">
import type { UserSummary } from '~/types/app'

defineProps<{
	users: UserSummary[]
	viewerUserId?: number
	labels: {
		rank: string
		player: string
		points: string
		totalPoints: string
		worldRecords: string
		openPlayer: string
	}
}>()
const { locale } = useI18n()
const formatter = computed(() => new Intl.NumberFormat(locale.value))
const format = (value?: number | null) => formatter.value.format(value ?? 0)
const userPath = (user: UserSummary) => `/user/${user.steamId}`
</script>
