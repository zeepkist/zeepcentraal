<template>
	<NuxtLink
		:to="tournamentPath(tournament.type, tournament.slug)"
		class="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/70 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		<NuxtImg
			v-if="tournament.level.imageUrl"
			:src="tournament.level.imageUrl"
			:alt="tournament.level.name"
			format="avif"
			width="1600"
			height="900"
			sizes="100vw md:50vw"
			class="aspect-video w-full object-cover"
			loading="lazy"
		/>
		<div v-else class="flex aspect-video items-center justify-center bg-muted">
			<TablerIcon name="photo-off" class="size-10 text-muted-foreground" />
		</div>

		<div class="flex flex-1 flex-col p-5">
			<div class="flex flex-wrap items-center gap-2">
				<UBadge color="primary" variant="soft">{{ formatName }}</UBadge>
				<UBadge color="neutral" variant="soft">{{ periodLabel }}</UBadge>
				<UBadge :color="active ? 'success' : 'neutral'" variant="soft">
					{{ active ? $t('tournaments.live') : $t('tournaments.finalized') }}
				</UBadge>
			</div>
			<h3 class="mt-3 truncate text-xl font-black text-highlighted">
				{{ tournament.level.name }}
			</h3>
			<p v-if="tournament.level.authorName" class="mt-1 truncate text-sm text-muted">
				{{ $t('tournaments.byAuthor', { author: tournament.level.authorName }) }}
			</p>
			<div class="mt-auto flex items-center justify-between gap-4 pt-5 text-sm">
				<span class="text-muted">
					{{ $t('tournaments.participants', { count: tournament.participantCount }) }}
				</span>
				<span class="flex items-center gap-1 font-bold text-primary">
					{{ $t('tournaments.viewTournament') }}
					<TablerIcon name="arrow-right" class="size-4 transition group-hover:translate-x-0.5" />
				</span>
			</div>
		</div>
	</NuxtLink>
</template>

<script setup vapor lang="ts">
import type { TournamentFeature } from '~/types/tournament'
import {
	formatTournamentPeriod,
	isTrackTournamentActive,
	tournamentPath,
} from '~/utils/tournament'

const props = defineProps<{ tournament: TournamentFeature }>()
const { locale, t } = useI18n()
const active = computed(() => isTrackTournamentActive(props.tournament))
const formatName = computed(() =>
	t(props.tournament.type === 0 ? 'pages.totw.title' : 'pages.totm.title'),
)
const periodLabel = computed(() =>
	formatTournamentPeriod(
		props.tournament.type,
		props.tournament.slug,
		locale.value,
		(period) => t('tournaments.weeklyPeriod', period),
	),
)
</script>
