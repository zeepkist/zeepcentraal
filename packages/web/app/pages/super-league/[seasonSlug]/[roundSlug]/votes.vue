<script setup vapor lang="ts">
const route = useRoute()
const { t } = useI18n()
const seasonId = parseSuperLeagueSlug(route.params.seasonSlug, 'season')
const roundNumber = parseSuperLeagueSlug(route.params.roundSlug, 'round')
if (seasonId === null || roundNumber === null) {
	throw createError({ statusCode: 404, statusMessage: t('zsl.notFound') })
}
</script>

<template>
	<VoteResults :season-id="seasonId" :round-number="roundNumber" />
</template>
