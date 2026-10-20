<template>
	<TournamentDetailPage :type="1" :title="t('pages.totm.title')" />
</template>

<script setup lang="ts">
const { t } = useAppI18n()

const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
defineOgImage('TrackTournament.takumi', { slug, type: 1 })
</script>
