<template>
	<UContainer class="py-2">
		<TournamentEvent :type="type" :slug="slug" :title="title" detail-page />
	</UContainer>
</template>

<script setup vapor lang="ts">
import type { TrackTournamentType } from '~/types/tournament'

defineProps<{ type: TrackTournamentType; title: string }>()
const route = useRoute()
const rawSlug = route.params.slug
const slug =
	typeof rawSlug === 'string' && /^[0-9]{4}-(?:w[0-9]{2}|[0-9]{2})$/.test(rawSlug)
		? rawSlug
		: null
if (!slug) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
</script>
