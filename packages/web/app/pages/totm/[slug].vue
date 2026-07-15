<template>
	<RoutePlaceholder
		:title="$t('pages.totmDetail.title')"
		:description="$t('pages.totmDetail.description', { slug })"
		:back-label="$t('pages.totmDetail.back')"
		back-to="/totm"
		icon="calendar-stats"
	/>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const rawSlug = route.params.slug
const slug =
	typeof rawSlug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)
		? rawSlug
		: null

if (slug === null) {
	throw createError({ statusCode: 404, statusMessage: t('pages.totmDetail.notFound') })
}

useSeoMeta({
	title: () => t('pages.totmDetail.seo.title', { slug }),
	description: () => t('pages.totmDetail.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
