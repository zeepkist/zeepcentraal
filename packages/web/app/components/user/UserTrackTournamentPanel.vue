<script setup vapor lang="ts">
import type { UserTrackTournamentResult } from '~/types/tournament'
import { formatTournamentPeriod, formatTournamentTime, tournamentPath } from '~/utils/tournament'

const props = defineProps<{
	id: string
	title: string
	description: string
	results: UserTrackTournamentResult[]
	pending: boolean
	error?: string
	canGoPrevious: boolean
	canGoNext: boolean
}>()
const emit = defineEmits<{ previous: []; next: [] }>()
const { locale, t } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
const rows = computed(() => props.results.map((result) => ({
	...result,
	to: tournamentPath(result.type, result.slug),
	period: formatTournamentPeriod(result.type, result.slug, locale.value, (period) =>
		t('tournaments.weeklyPeriod', period),
	),
	formattedTime: formatTournamentTime(result.time),
})))

function previous() {
	if (props.canGoPrevious && !props.pending) emit('previous')
}

function next() {
	if (props.canGoNext && !props.pending) emit('next')
}
</script>

<template>
	<section :aria-labelledby="id">
		<SectionHeader :id="id" :title="title" :description="description" />
		<DataState
			:pending="pending"
			:error="error"
			:empty="results.length === 0"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('users.profile.trackTournaments.noResults')"
			:skeletons="2"
		>
			<ul class="space-y-3">
				<li v-for="row in rows" :key="row.id">
					<NuxtLink
						:to="row.to"
						class="group block min-w-0 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 transition duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						<div class="flex items-start gap-3 p-3">
							<div class="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
								<NuxtImg
									v-if="row.imageUrl"
									:src="row.imageUrl"
									:alt="row.levelName ?? $t('common.unavailable')"
									format="avif"
									width="320"
									height="240"
									sizes="80px"
									class="absolute inset-0 size-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
									loading="lazy"
								/>
								<div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-muted to-primary/10">
									<TablerIcon name="photo-off" class="size-6 text-muted-foreground" />
								</div>
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
									<p class="text-[10px] font-bold uppercase tracking-wide text-primary" :title="row.period">{{ row.period }}</p>
									<UBadge v-if="row.finalizedAt === null" color="warning" variant="soft" size="sm">
										{{ $t('users.profile.trackTournaments.provisional') }}
									</UBadge>
								</div>
								<h3 class="mt-1 line-clamp-2 text-sm font-black leading-snug text-highlighted transition-colors group-hover:text-primary" :title="row.levelName ?? undefined">{{ row.levelName ?? $t('common.unavailable') }}</h3>
								<p v-if="row.authorName" class="mt-1 truncate text-xs text-muted-foreground" :title="row.authorName">
									{{ $t('tournaments.byAuthor', { author: row.authorName }) }}
								</p>
							</div>
						</div>
						<dl class="grid grid-cols-3 items-end gap-3 border-t border-border bg-muted/30 px-3 py-2.5">
							<div class="min-w-0">
								<dt class="text-[10px] font-semibold tracking-wide text-muted-foreground">{{ $t('tournaments.rank') }}</dt>
								<dd class="mt-0.5 flex items-center gap-1 font-black tabular-nums" :class="row.rank <= 3 ? 'text-primary' : 'text-highlighted'">
									<TablerIcon v-if="row.rank <= 3" name="trophy" class="size-4 shrink-0" />
									<span class="text-lg">#{{ number.format(row.rank) }}</span>
								</dd>
							</div>
							<div class="min-w-0">
								<dt class="text-[10px] font-semibold tracking-wide text-muted-foreground">{{ $t('tournaments.points') }}</dt>
								<dd class="mt-0.5 text-lg font-black tabular-nums text-primary">{{ number.format(row.points) }}</dd>
							</div>
							<div class="min-w-0">
								<dt class="text-[10px] font-semibold tracking-wide text-muted-foreground">{{ $t('tournaments.time') }}</dt>
								<dd class="mt-0.5 text-lg font-semibold tabular-nums text-highlighted">{{ row.formattedTime }}</dd>
							</div>
						</dl>
					</NuxtLink>
				</li>
			</ul>
		</DataState>
		<nav v-if="canGoPrevious || canGoNext" class="mt-3 flex items-center justify-between gap-2" :aria-label="$t('users.profile.trackTournaments.pagination', { tournament: title })">
			<UButton color="neutral" variant="soft" icon="i-tabler-chevron-left" :disabled="!canGoPrevious || pending" @click="previous">
				{{ $t('common.previous') }}
			</UButton>
			<UButton color="neutral" variant="soft" trailing-icon="i-tabler-chevron-right" :disabled="!canGoNext || pending" @click="next">
				{{ $t('common.next') }}
			</UButton>
		</nav>
	</section>
</template>
