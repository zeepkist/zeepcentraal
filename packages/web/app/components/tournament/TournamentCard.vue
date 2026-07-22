<template>
	<NuxtLink :to="to ?? tournamentPath(tournament.type, tournament.slug)" class="group block h-full overflow-hidden rounded-2xl border border-border bg-card/60 transition hover:border-primary/50 hover:shadow-lg">
		<NuxtImg v-if="tournament.level.imageUrl" :src="tournament.level.imageUrl" :alt="tournament.level.name" class="aspect-video w-full object-cover" loading="lazy" />
		<div class="p-4">
			<div class="flex items-center justify-between gap-3"><h3 class="truncate text-lg font-bold text-highlighted">{{ tournament.level.name }}</h3><UBadge variant="soft">{{ periodLabel }}</UBadge></div>
			<p class="mt-1 truncate text-sm text-muted">{{ tournament.level.authorName }}</p>
			<div class="mt-4 flex items-center justify-between text-sm"><span class="text-muted">{{ $t('tournaments.participants', { count: tournament.participantCount }) }}</span><span v-if="winner" class="font-semibold text-primary">#1 {{ winner.steamName ?? winner.steamId }}</span></div>
		</div>
	</NuxtLink>
</template>

<script setup lang="ts">
import type { TournamentSummary } from '~/types/tournament'
import { formatTournamentPeriod, tournamentPath } from '~/utils/tournament'

const props = defineProps<{ tournament: TournamentSummary; to?: string }>()
const { locale, t } = useI18n()
const winner = computed(() => props.tournament.podium[0])
const periodLabel = computed(() =>
	formatTournamentPeriod(props.tournament.type, props.tournament.slug, locale.value, (period) =>
		t('tournaments.weeklyPeriod', period),
	),
)
</script>
