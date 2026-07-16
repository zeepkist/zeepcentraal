<template>
	<RoutePlaceholder
		:title="$t('pages.totwDetail.title')"
		:description="$t('pages.totwDetail.description', { slug })"
		:back-label="$t('pages.totwDetail.back')"
		back-to="/totw"
		icon="calendar-event"
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
	throw createError({ statusCode: 404, statusMessage: t('pages.totwDetail.notFound') })
}

useSeoMeta({
	title: () => t('pages.totwDetail.seo.title', { slug }),
	description: () => t('pages.totwDetail.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
