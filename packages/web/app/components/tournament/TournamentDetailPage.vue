<template>
	<UContainer class="py-2">
		<TournamentEvent :type="type" :slug="slug" :title="title" detail-page />
	</UContainer>
</template>

<script setup lang="ts">
import type { TrackTournamentType } from '~/types/tournament'
import { validTournamentSlug } from '~/utils/tournament'

const props = defineProps<{ type: TrackTournamentType; title: string }>()
const route = useRoute<'totm-slug' | 'totw-slug' | 'totd-slug'>()
const rawSlug = route.params.slug
const slug =
	typeof rawSlug === 'string' && validTournamentSlug(props.type, rawSlug)
		? rawSlug
		: null
if (!slug) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
</script>
