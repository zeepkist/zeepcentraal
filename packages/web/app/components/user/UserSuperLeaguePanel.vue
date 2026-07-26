<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="labels.title" :description="labels.description" />

		<div class="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-1">
			<USelect
				:model-value="selectedSeasonId"
				:items="seasons"
				value-key="value"
				label-key="label"
				icon="i-tabler-trophy"
				:aria-label="labels.season"
				:disabled="seasons.length === 0"
				@update:model-value="selectSeason"
			/>
			<UButton
				:to="standingsTo"
				color="primary"
				variant="soft"
				icon="i-tabler-list-numbers"
				:disabled="!standingsTo"
				class="justify-center"
			>
				{{ labels.viewStandings }}
			</UButton>
		</div>

		<DataState
			:pending="pending"
			:error="error"
			:empty="seasons.length === 0"
			:loading-label="labels.loading"
			:error-title="labels.error"
			:empty-title="labels.noSeasons"
			:skeletons="2"
		>
			<div v-if="season" class="space-y-3">
				<div class="grid grid-cols-3 gap-2">
					<div class="rounded-xl border border-border bg-card/70 p-3">
						<p class="text-xs text-muted-foreground">{{ labels.position }}</p>
						<p class="mt-1 text-lg font-black tabular-nums text-highlighted">
							{{ season.position == null ? labels.emptyValue : `#${number.format(season.position)}` }}
						</p>
					</div>
					<div class="rounded-xl border border-border bg-card/70 p-3">
						<p class="text-xs text-muted-foreground">{{ labels.points }}</p>
						<p class="mt-1 text-lg font-black tabular-nums text-highlighted">
							{{ season.points == null ? labels.emptyValue : number.format(season.points) }}
						</p>
					</div>
					<div class="rounded-xl border border-border bg-card/70 p-3">
						<p class="text-xs text-muted-foreground">{{ labels.roundsEntered }}</p>
						<p class="mt-1 text-lg font-black tabular-nums text-highlighted">
							{{ number.format(season.rounds.length) }}
						</p>
					</div>
				</div>

				<div v-if="season.rounds.length > 0" class="overflow-hidden rounded-xl border border-border">
					<div class="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
						<span>{{ labels.roundResults }}</span>
						<span>{{ labels.bestOf(season.bestOf) }}</span>
					</div>
					<ul class="divide-y divide-border">
						<li v-for="round in season.rounds" :key="round.id" class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 bg-card/50 px-3 py-2.5">
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold text-highlighted">{{ round.name }}</p>
								<p class="text-xs text-muted-foreground">{{ labels.round(round.round) }}</p>
							</div>
							<UBadge color="neutral" variant="soft">#{{ number.format(round.position) }}</UBadge>
							<span
								class="w-10 text-right font-bold tabular-nums"
								:class="round.counted ? 'text-highlighted' : 'text-muted-foreground'"
								:aria-label="round.counted ? undefined : labels.excluded(season.bestOf)"
								:title="round.counted ? undefined : labels.excluded(season.bestOf)"
							>
								{{ round.counted ? number.format(round.points) : labels.emptyValue }}
							</span>
						</li>
					</ul>
				</div>
				<div v-else class="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
					{{ labels.noResults }}
				</div>
			</div>
		</DataState>
	</section>
</template>

<script setup vapor lang="ts">
import type { UserSuperLeagueSummary } from '~/types/app'

defineProps<{
	id: string
	selectedSeasonId?: number
	seasons: Array<{ label: string; value: number }>
	season: UserSuperLeagueSummary | null
	standingsTo?: string
	pending: boolean
	error?: string | null
	labels: {
		title: string
		description: string
		season: string
		viewStandings: string
		position: string
		points: string
		roundsEntered: string
		roundResults: string
		bestOf: (count: number) => string
		round: (round: number) => string
		excluded: (count: number) => string
		noSeasons: string
		noResults: string
		loading: string
		error: string
		emptyValue: string
	}
}>()

const emit = defineEmits<{ 'update:selectedSeasonId': [value: number] }>()
const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))

function selectSeason(value: unknown) {
	const seasonId = Number(value)
	if (Number.isInteger(seasonId) && seasonId > 0) emit('update:selectedSeasonId', seasonId)
}
</script>
