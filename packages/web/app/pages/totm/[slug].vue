<template>
	<TournamentDetailPage :type="1" :title="$t('pages.totm.title')" />
</template>

<script setup vapor lang="ts">
const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
defineOgImage('TrackTournament.takumi', { slug, type: 1 })
</script>
