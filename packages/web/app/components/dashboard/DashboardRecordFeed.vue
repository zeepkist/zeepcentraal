<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-xl font-semibold">{{ title }}</h2>
				<p class="text-sm text-muted-foreground">{{ description }}</p>
			</div>
			<UBadge color="success" variant="soft" role="status">{{ liveLabel }}</UBadge>
		</div>
		<RecordTable
			:records="records"
			:rank-label="rankLabel"
			:user-label="userLabel"
			:level-label="levelLabel"
			:time-label="timeLabel"
			:date-label="dateLabel"
			show-level
		/>
	</UCard>
</template>

<script setup lang="ts">
import type { RecordRow } from '~/types/app'

defineProps<{
	title: string
	description: string
	liveLabel: string
	records: RecordRow[]
	rankLabel: string
	userLabel: string
	levelLabel: string
	timeLabel: string
	dateLabel: string
}>()
</script>
