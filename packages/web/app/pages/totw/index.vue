<template>
	<TournamentIndexPage :type="0" :title="t('pages.totw.title')" />
</template>

<script setup lang="ts">
const { t } = useAppI18n()

defineOgImage('TrackTournament.takumi', { slug: 'totw', type: 0 })
</script>
