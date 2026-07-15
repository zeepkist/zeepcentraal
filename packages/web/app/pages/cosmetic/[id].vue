<template>
	<RoutePlaceholder
		:title="$t('pages.cosmeticDetail.title')"
		:description="$t('pages.cosmeticDetail.description', { id: cosmeticId })"
		:back-label="$t('pages.cosmeticDetail.back')"
		back-to="/cosmetics"
		icon="palette"
	/>
</template>

<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const rawCosmeticId = route.params.id
const cosmeticId =
	typeof rawCosmeticId === 'string' && /^\d+$/.test(rawCosmeticId)
		? Number(rawCosmeticId)
		: null

if (cosmeticId === null || !Number.isSafeInteger(cosmeticId) || cosmeticId < 1) {
	throw createError({
		statusCode: 404,
		statusMessage: t('pages.cosmeticDetail.notFound'),
	})
}

useSeoMeta({
	title: () => t('pages.cosmeticDetail.seo.title', { id: cosmeticId }),
	description: () => t('pages.cosmeticDetail.seo.description'),
	robots: 'noindex, nofollow',
})
</script>
