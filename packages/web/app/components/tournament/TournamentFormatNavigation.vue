<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import { tournamentPath } from '~/utils/tournament'

defineProps<{ type: TrackTournamentType; overall?: boolean }>()
const { t } = useAppI18n()
</script>

<template>
	<nav :aria-label="t('tournaments.overall.navigation')" class="flex flex-wrap gap-2">
		<UButton :to="tournamentPath(type)" :variant="overall ? 'ghost' : 'soft'" color="neutral" :aria-current="!overall ? 'page' : undefined">
			{{ t('tournaments.overall.currentEvent') }}
		</UButton>
		<UButton :to="tournamentPath(type, 'overall')" :variant="overall ? 'soft' : 'ghost'" color="neutral" :aria-current="overall ? 'page' : undefined">
			{{ t('tournaments.overall.title') }}
		</UButton>
	</nav>
</template>
