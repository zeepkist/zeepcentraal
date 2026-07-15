<template>
	<RoutePlaceholder
		:title="$t('pages.totm.title')"
		:description="$t('pages.totm.description')"
		:back-label="$t('pages.totm.back')"
		back-to="/"
		icon="calendar-stats"
	/>
</template>

<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
	title: () => t('pages.totm.seo.title'),
	description: () => t('pages.totm.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
