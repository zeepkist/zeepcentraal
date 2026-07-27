<template>
	<section
		class="relative isolate overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-xl shadow-primary/5 sm:p-7 lg:p-9"
	>
		<div class="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl" />
		<div class="relative grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
			<div class="min-w-0">
				<div class="flex flex-wrap gap-2">
					<UBadge v-if="record.isWorldRecord" color="primary" variant="solid">
						{{ labels.worldRecord }}
					</UBadge>
					<UBadge v-else-if="record.isPersonalBest" class="bg-purple-500/15 text-purple-300 ring-purple-400/25" variant="soft">
						{{ labels.personalBest }}
					</UBadge>
					<UBadge color="neutral" variant="soft">{{ labels.record(record.recordId) }}</UBadge>
				</div>
				<p class="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-primary">
					{{ labels.recordTime }}
				</p>
				<h1 class="mt-1 text-5xl font-black tabular-nums tracking-tight text-highlighted sm:text-7xl">
					{{ formatTime(record.time) }}
				</h1>
				<div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-muted-foreground">
					<NuxtLink
						v-if="record.userSteamId"
						:to="`/user/${record.userSteamId}`"
						class="inline-flex items-center gap-2 font-semibold transition hover:text-primary"
					>
						<TablerIcon name="user" class="size-5" />
						{{ record.userName ?? labels.unknownPlayer }}
					</NuxtLink>
					<span v-else class="inline-flex items-center gap-2 font-semibold">
						<TablerIcon name="user" class="size-5" />
						{{ record.userName ?? labels.unknownPlayer }}
					</span>
					<NuxtLink
						:to="`/level/${levelHash}`"
						class="inline-flex items-center gap-2 font-semibold transition hover:text-primary"
					>
						<TablerIcon name="road" class="size-5" />
						{{ levelName }}
					</NuxtLink>
					<span class="inline-flex items-center gap-2 text-sm">
						<TablerIcon name="calendar-event" class="size-4" />
						{{ labels.set }} <NuxtTime :datetime="record.dateCreated" relative />
					</span>
				</div>

				<div class="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">
					<div v-for="metric in metrics" :key="metric.label" class="rounded-xl border border-border/70 bg-default/55 px-4 py-3">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ metric.label }}</p>
						<p class="mt-1 truncate text-lg font-black tabular-nums text-highlighted">{{ metric.value }}</p>
					</div>
				</div>
			</div>

			<div class="overflow-hidden rounded-2xl border border-border/70 bg-default/70 shadow-lg">
				<NuxtImg
					v-if="imageUrl"
					:src="imageUrl"
					:alt="levelName"
					format="avif"
					width="1600"
					height="900"
					sizes="100vw lg:40vw"
					class="aspect-video w-full object-cover"
					loading="eager"
					preload
					fetchpriority="high"
				/>
				<div v-else class="flex aspect-video items-center justify-center bg-muted">
					<TablerIcon name="photo-off" class="size-12 text-muted-foreground" />
				</div>
			</div>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import type { GhostRecordSource } from '~/types/ghost'
import { getNumberFormatter } from '~/utils/intlFormatters'

const props = defineProps<{
	record: GhostRecordSource
	levelHash: string
	levelName: string
	imageUrl?: string | null
	gameVersion?: string | null
	modVersion?: string | null
	ghostVersion?: number | null
	levelRank?: number | null
	rankedPoints?: number | null
	labels: {
		worldRecord: string
		personalBest: string
		record: (id: number) => string
		recordTime: string
		unknownPlayer: string
		set: string
		gameVersion: string
		modVersion: string
		ghostVersion: string
		levelRank: string
		rankedPoints: string
		unavailable: string
	}
}>()

const { locale } = useI18n()
const numberFormat = computed(() => getNumberFormatter(locale.value, 'one-decimal'))
const metrics = computed(() => [
	{ label: props.labels.levelRank, value: props.levelRank ? `#${numberFormat.value.format(props.levelRank)}` : props.labels.unavailable },
	{ label: props.labels.rankedPoints, value: formatNumber(props.rankedPoints) },
	{ label: props.labels.ghostVersion, value: props.ghostVersion ? `V${props.ghostVersion}` : props.labels.unavailable },
	{
		label: props.labels.gameVersion,
		value: props.gameVersion || props.labels.unavailable,
	},
	{ label: props.labels.modVersion, value: props.modVersion || props.labels.unavailable },
])

function formatNumber(value: number | null | undefined) {
	return value == null ? props.labels.unavailable : numberFormat.value.format(value)
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60)
	return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, '0')}`
}
</script>
