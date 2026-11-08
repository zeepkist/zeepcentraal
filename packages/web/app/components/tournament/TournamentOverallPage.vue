<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'

const props = defineProps<{ type: TrackTournamentType; title: string }>()
const { t } = useAppI18n()
useSeoMeta({
	title: () => `${props.title} · ${t('tournaments.overall.title')}`,
	description: () => t('tournaments.overall.description', { title: props.title }),
	robots: 'index, follow',
})
// Nuxt SEO supplies route-specific canonical URLs, excluding pagination queries.
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<TournamentFormatNavigation :type="type" overall />
		<section class="space-y-5">
			<header>
				<h1 class="text-2xl font-bold">{{ title }} · {{ t('tournaments.overall.title') }}</h1>
				<p class="mt-1 text-muted-foreground">{{ t('tournaments.overall.description', { title }) }}</p>
			</header>
			<TournamentOverallLeaderboard :type="type" />
		</section>
	</UContainer>
</template>
