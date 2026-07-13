<template>
	<div class="overflow-x-auto rounded-xl border border-border">
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
				<tr
					v-for="(record, index) in records"
					:key="record.id"
					class="border-t border-border"
					:class="record.viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60'"
				>
					<td v-if="showRank" class="px-4 py-3 tabular-nums">{{ record.rank ?? index + 1 }}</td>
					<td v-if="showUser" class="px-4 py-3">
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
					<td v-if="showPoints" class="px-4 py-3 font-semibold tabular-nums">
						<span v-if="record.points != null">{{ pointNumber.format(record.points) }}</span>
					</td>
					<td v-if="showPbOrWr" class="px-4 py-3">
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
					</td>
					<td class="px-4 py-3 font-semibold tabular-nums">{{ formatTime(record.time) }}</td>
					<td class="px-4 py-3 text-muted-foreground text-right"><NuxtTime :datetime="record.dateCreated" relative numeric="auto" relative-style="short" /></td>
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
		showUser?: boolean
		showRank?: boolean
		showPoints?: boolean
		showPbOrWr?: boolean
		pointsLabel?: string
		pbOrWrLabel?: string
		personalBestLabel?: string
		worldRecordLabel?: string
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
</script>
