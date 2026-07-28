<template>
	<TournamentIndexPage :type="1" :title="$t('pages.totm.title')" />
</template>

<script setup vapor lang="ts">
defineOgImage('TrackTournament.takumi', { slug: 'totm', type: 1 })
</script>
