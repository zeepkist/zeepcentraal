<template>
	<RoutePlaceholder
		:title="$t('pages.cosmetics.title')"
		:description="$t('pages.cosmetics.description')"
		:back-label="$t('pages.cosmetics.back')"
		back-to="/"
		icon="palette"
	/>
</template>

<script setup vapor lang="ts">
const { t } = useI18n()

useSeoMeta({
	title: () => t('pages.cosmetics.seo.title'),
	description: () => t('pages.cosmetics.seo.description'),
	robots: 'noindex, nofollow',
})
defineOgImage('Cosmetics.takumi', { slug: 'cosmetics' })
</script>
