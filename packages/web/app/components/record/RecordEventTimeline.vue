<template>
	<div class="overflow-hidden rounded-2xl border border-border bg-linear-to-br from-card to-primary/5">
		<div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 p-4">
			<div>
				<h3 class="font-bold text-highlighted">{{ labels.title }}</h3>
				<p class="mt-1 text-xs text-muted-foreground">{{ labels.description }}</p>
			</div>
			<span class="rounded-lg bg-primary/10 p-1.5 text-primary">
				<TablerIcon :name="labels.icon" class="size-4" />
			</span>
		</div>

		<div v-if="visibleLanes.length > 0" class="overflow-x-auto p-4">
			<div class="min-w-2xl space-y-2">
				<div
					v-for="lane in visibleLanes"
					:key="lane.kind"
					class="grid grid-cols-[9rem_minmax(32rem,1fr)] items-center gap-3"
				>
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-lg"
							:style="{ backgroundColor: `${labels.config[lane.kind].color}1f`, color: labels.config[lane.kind].color }"
						>
							<TablerIcon :name="labels.config[lane.kind].icon" class="size-4" />
						</span>
						<span class="truncate text-xs font-semibold text-highlighted">
							{{ labels.config[lane.kind].label }}
						</span>
						<UBadge color="neutral" variant="soft" size="xs">
							{{ numberFormat.format(lane.events.length) }}
						</UBadge>
					</div>

					<div class="relative h-8 overflow-hidden rounded-lg border border-border/70 bg-muted/35">
						<div
							v-for="tick in ticks"
							:key="tick"
							class="pointer-events-none absolute inset-y-0 border-l border-border/50"
							:style="{ left: `${tickPosition(tick)}%` }"
						/>
						<UTooltip
							v-for="event in lane.events"
							:key="event.id"
							:text="eventTooltip(event, lane.kind)"
						>
							<button
								type="button"
								class="absolute inset-y-1 min-w-1 rounded-sm opacity-75 transition-opacity hover:opacity-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
								:style="eventStyle(event, lane.kind)"
								:aria-label="eventTooltip(event, lane.kind)"
								@mousedown.prevent
								@click="emit('seek', event.start)"
							/>
						</UTooltip>
						<div
							v-if="currentTime !== undefined"
							class="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary shadow-[0_0_8px_var(--color-primary)]"
							:style="{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }"
						/>
					</div>
				</div>

				<div class="grid grid-cols-[9rem_minmax(32rem,1fr)] gap-3">
					<div />
					<div class="relative h-5 text-[0.65rem] tabular-nums text-muted-foreground">
						<span
							v-for="tick in ticks"
							:key="tick"
							class="absolute -translate-x-1/2"
							:style="{ left: `${tickPosition(tick)}%` }"
						>
							{{ formatElapsed(tick) }}
						</span>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="grid min-h-40 place-items-center px-6 text-sm text-muted-foreground">
			{{ labels.emptyLabel }}
		</div>
	</div>
</template>

<script setup lang="ts">
import type { GhostEventKind, GhostTimelineEvent } from '~/types/ghost'
import type { RecordAnalysisLabels } from '~/utils/recordAnalysisLabels'
import type { RecordTimelineLane } from '~/utils/recordGhostAnalysis'

const props = defineProps<{
	events: GhostTimelineEvent[]
	duration: number
	currentTime?: number
	labels: RecordAnalysisLabels['events']
}>()

const emit = defineEmits<{ seek: [time: number] }>()
const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const decimalFormat = computed(
	() => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
)
const visibleLanes = computed<RecordTimelineLane[]>(() => {
	const groups = new Map<GhostEventKind, GhostTimelineEvent[]>()
	for (const event of props.events) {
		const events = groups.get(event.kind) ?? []
		events.push(event)
		groups.set(event.kind, events)
	}
	return [...groups.entries()].map(([kind, events]) => ({ kind, events }))
})
const ticks = computed(() => {
	const count = 5
	return Array.from({ length: count }, (_, index) => (props.duration * index) / (count - 1))
})

function formatElapsed(value: number) {
	const minutes = Math.floor(value / 60)
	const seconds = value - minutes * 60
	return minutes > 0
		? `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
		: `${decimalFormat.value.format(seconds)} ${props.labels.secondsUnit}`
}

function eventTooltip(event: GhostTimelineEvent, kind: GhostEventKind) {
	return `${props.labels.config[kind].label} · ${props.labels.atLabel} ${formatElapsed(event.start)} · ${props.labels.durationLabel} ${formatElapsed(event.duration)}`
}

function eventStyle(event: GhostTimelineEvent, kind: GhostEventKind) {
	const safeDuration = Math.max(props.duration, 0.001)
	return {
		left: `${Math.min(100, Math.max(0, (event.start / safeDuration) * 100))}%`,
		width: `${Math.max(0.3, (event.duration / safeDuration) * 100)}%`,
		backgroundColor: props.labels.config[kind].color,
	}
}

function tickPosition(tick: number) {
	return (tick / Math.max(props.duration, 0.001)) * 100
}
</script>
