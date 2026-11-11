<template>
	<TournamentIndexPage :type="2" :title="t('pages.totd.title')" />
</template>

<script setup lang="ts">
const { t } = useAppI18n()

defineOgImage('TrackTournament.takumi', { slug: 'totd', type: 2 })
</script>
