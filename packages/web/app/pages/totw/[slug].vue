<template>
	<TournamentDetailPage :type="0" :title="t('pages.totw.title')" />
</template>

<script setup lang="ts">
const { t } = useAppI18n()

const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
defineOgImage('TrackTournament.takumi', { slug, type: 0 })
</script>
