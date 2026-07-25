<template>
	<div class="grid gap-3" :class="stacked ? 'grid-cols-1' : 'sm:grid-cols-2'">
		<div class="flex items-center gap-3 rounded-xl border border-border/70 bg-default/55 px-4 py-3">
			<span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
				<TablerIcon name="users-group" class="size-5" />
			</span>
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{{ labels.competitors }}
				</p>
				<p class="mt-0.5 text-xl font-black tabular-nums text-highlighted">
					{{ numberFormat.format(competitorCount) }}
				</p>
			</div>
		</div>
		<div
			v-if="eventDate"
			class="flex items-center gap-3 rounded-xl border border-border/70 bg-default/55 px-4 py-3"
		>
			<span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
				<TablerIcon name="calendar-event" class="size-5" />
			</span>
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{{ labels.playedOn }}
				</p>
				<p class="mt-0.5 font-bold text-highlighted">
					<NuxtTime :datetime="String(eventDate)" date-style="long" />
				</p>
			</div>
		</div>
	</div>
</template>

<script setup vapor lang="ts">
defineProps<{
	competitorCount: number
	eventDate?: unknown
	stacked?: boolean
	labels: { competitors: string; playedOn: string }
}>()

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
</script>
