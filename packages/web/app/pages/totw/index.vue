<template>
	<RoutePlaceholder
		:title="$t('pages.totw.title')"
		:description="$t('pages.totw.description')"
		:back-label="$t('pages.totw.back')"
		back-to="/"
		icon="calendar-event"
	/>
</template>

<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
	title: () => t('pages.totw.seo.title'),
	description: () => t('pages.totw.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
