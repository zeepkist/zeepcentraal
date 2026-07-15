<template>
	<RoutePlaceholder
		:title="$t('pages.recordDetail.title')"
		:description="$t('pages.recordDetail.description', { id: recordId })"
		:back-label="$t('pages.recordDetail.back')"
		back-to="/records"
		icon="flag"
	/>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const rawRecordId = route.params.recordId
const recordId =
	typeof rawRecordId === 'string' && /^\d+$/.test(rawRecordId) ? Number(rawRecordId) : null
if (recordId === null || !Number.isSafeInteger(recordId) || recordId < 1) {
	throw createError({
		statusCode: 404,
		statusMessage: t('pages.recordDetail.notFound'),
	})
}

useSeoMeta({
	title: () => t('pages.recordDetail.seo.title', { id: recordId }),
	description: () => t('pages.recordDetail.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
