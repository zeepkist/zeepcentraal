<template>
	<DataTableFrame>
		<table
			class="w-full table-fixed text-left text-sm"
			:class="tableWidthClass"
		>
			<colgroup>
				<col class="w-[7rem]" />
				<col />
				<col v-if="showTime" class="w-[9rem]" />
				<col v-if="showLevelsPlayed" class="w-[9rem]" />
				<col v-for="label in roundLabels" :key="label" class="w-[5.5rem]" />
				<col class="w-[8rem]" />
			</colgroup>
			<thead class="bg-muted/70 text-muted-foreground">
				<tr>
					<th class="px-4 py-3" scope="col">{{ labels.position }}</th>
					<th class="px-4 py-3" scope="col">{{ labels.player }}</th>
					<th v-if="showTime" class="px-4 py-3" scope="col">{{ labels.time }}</th>
					<th v-if="showLevelsPlayed" class="px-4 py-3" scope="col">
						{{ labels.levelsPlayed }}
					</th>
					<th v-for="label in roundLabels" :key="label" class="px-4 py-3" scope="col">
						{{ label }}
					</th>
					<th class="px-4 py-3" scope="col">{{ labels.points }}</th>
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
					<td class="px-4 py-3 font-black tabular-nums">
						#{{ number.format(row.position) }}
					</td>
					<td class="px-4 py-3">
						<div class="flex min-w-0 items-center gap-2">
							<NuxtLink
								v-if="row.steamId"
								:to="`/user/${row.steamId}`"
								class="truncate font-semibold hover:text-primary"
							>
								{{ row.steamName ?? row.steamId }}
							</NuxtLink>
							<span v-else class="truncate text-muted-foreground">{{ labels.unknown }}</span>
							<UBadge v-if="row.pinned" color="primary" variant="soft" size="sm">
								{{ labels.yourStanding }}
							</UBadge>
						</div>
					</td>
					<td v-if="showTime" class="px-4 py-3 font-semibold tabular-nums">
						{{ row.time == null ? labels.emptyValue : formatTime(row.time) }}
					</td>
					<td v-if="showLevelsPlayed" class="px-4 py-3 font-semibold tabular-nums">
						{{ row.levelsPlayed == null ? labels.emptyValue : number.format(row.levelsPlayed) }}
					</td>
					<td
						v-for="(_, index) in roundLabels"
						:key="index"
						class="px-4 py-3 font-semibold tabular-nums"
					>
						{{
							row.roundPoints?.[index] == null
								? labels.emptyValue
								: number.format(row.roundPoints[index] ?? 0)
						}}
					</td>
					<td class="px-4 py-3 font-bold tabular-nums">
						{{ number.format(row.points) }}
					</td>
				</tr>
			</tbody>
		</table>
	</DataTableFrame>
</template>

<script setup lang="ts">
import type { ZslStanding } from '~/types/app'

const props = withDefaults(
	defineProps<{
		standings: ZslStanding[]
		showTime?: boolean
		showLevelsPlayed?: boolean
		roundLabels?: string[]
		viewerUserId?: number
		labels: {
			position: string
			player: string
			time: string
			points: string
			levelsPlayed: string
			unknown: string
			yourStanding: string
			emptyValue: string
		}
	}>(),
	{ roundLabels: () => [], showLevelsPlayed: false, showTime: false },
)

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const tableWidthClass = computed(() => {
	if (props.roundLabels.length > 0) return 'min-w-[68rem]'
	if (props.showLevelsPlayed) return 'min-w-[42rem]'
	return props.showTime ? 'min-w-[40rem]' : 'min-w-[32rem]'
})

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
