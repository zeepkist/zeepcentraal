<template>
	<NuxtLink
		:to="targetRoute"
		class="group block h-full overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
		@click.capture="beginTransition"
	>
		<div
			class="aspect-video w-full overflow-hidden bg-muted"
			:style="transition.sourceStyle(transitionScope, 'tournament', transitionId, 'media')"
			data-shared-transition-source="media"
		>
			<NuxtImg
				v-if="tournament.level.imageUrl"
				:src="tournament.level.imageUrl"
				:alt="tournament.level.name"
				format="avif"
				width="1600"
				height="900"
				sizes="100vw sm:50vw xl:33vw"
				class="size-full object-cover"
				loading="lazy"
			/>
			<div v-else class="grid size-full place-items-center">
				<TablerIcon name="photo-off" class="size-10 text-muted-foreground" />
			</div>
		</div>
		<div class="p-4">
			<div class="flex items-center justify-between gap-3"><h3 class="truncate text-lg font-bold text-highlighted">{{ tournament.level.name }}</h3><UBadge variant="soft">{{ periodLabel }}</UBadge></div>
			<p class="mt-1 truncate text-sm text-muted">{{ tournament.level.authorName }}</p>
			<div class="mt-4 flex items-center justify-between text-sm"><span class="text-muted">{{ $t('tournaments.participants', { count: tournament.participantCount }) }}</span><span v-if="winner" class="font-semibold text-primary">#1 {{ winner.steamName ?? winner.steamId }}</span></div>
		</div>
	</NuxtLink>
</template>

<script setup vapor lang="ts">
import type { TournamentSummary } from '~/types/tournament'
import { formatTournamentPeriod, tournamentPath } from '~/utils/tournament'

const props = defineProps<{
	tournament: TournamentSummary
	to?: string
	transitionScope: string
}>()
const { locale, t } = useI18n()
const transition = useSharedViewTransition()
const winner = computed(() => props.tournament.podium[0])
const transitionId = computed(() => `${props.tournament.type}:${props.tournament.slug}`)
const targetRoute = computed(
	() => props.to ?? tournamentPath(props.tournament.type, props.tournament.slug),
)
const periodLabel = computed(() =>
	formatTournamentPeriod(props.tournament.type, props.tournament.slug, locale.value, (period) =>
		t('tournaments.weeklyPeriod', period),
	),
)

function beginTransition(event: MouseEvent) {
	transition.begin({
		event,
		entity: 'tournament',
		entityId: transitionId.value,
		scope: props.transitionScope,
		targetRoute: targetRoute.value,
		preview: {
			title: props.tournament.level.name,
			subtitle: props.tournament.level.authorName ?? undefined,
			mediaUrl: props.tournament.level.imageUrl ?? null,
			mediaAlt: props.tournament.level.name,
		},
	})
}
</script>
