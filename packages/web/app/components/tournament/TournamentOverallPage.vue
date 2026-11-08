<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'

const props = defineProps<{ type: TrackTournamentType; title: string }>()
const { t } = useAppI18n()
const pageTitle = computed(() => t('tournaments.overall.pageTitle', { title: props.title }))
const description = computed(() => t(props.type === 0 ? 'tournaments.overall.weeklyWindow' : 'tournaments.overall.monthlyWindow'))
useSeoMeta({
	title: () => pageTitle.value,
	description: () => description.value,
	robots: 'index, follow',
})
// Nuxt SEO supplies route-specific canonical URLs, excluding pagination queries.
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<TournamentFormatNavigation :type="type" overall />
		<section class="space-y-5">
			<PageHeader :title="pageTitle" :description="description" />
			<TournamentOverallLeaderboard :type="type" />
		</section>
	</UContainer>
</template>
