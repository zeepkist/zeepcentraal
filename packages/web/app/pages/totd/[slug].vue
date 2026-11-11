<template>
	<TournamentDetailPage :type="2" :title="t('pages.totd.title')" />
</template>

<script setup lang="ts">
const { t } = useAppI18n()

const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
defineOgImage('TrackTournament.takumi', { slug, type: 2 })
</script>
