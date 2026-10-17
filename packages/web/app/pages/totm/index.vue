<template>
	<TournamentIndexPage :type="1" :title="t('pages.totm.title')" />
</template>

<script setup vapor lang="ts">
const { t } = useAppI18n()

defineOgImage('TrackTournament.takumi', { slug: 'totm', type: 1 })
</script>
