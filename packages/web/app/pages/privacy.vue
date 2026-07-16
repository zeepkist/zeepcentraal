<template>
	<LegalDocument
		v-if="document"
		:eyebrow="$t('pages.privacy.eyebrow')"
		:title="$t('pages.privacy.title')"
		:description="$t('pages.privacy.description')"
		:document="document"
	/>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { data: document } = await useAsyncData('legal-privacy', () =>
	queryCollection('legal').path('/legal/privacy').first(),
)

if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.privacy.notFound') })
}

usePageSeo('privacy')
</script>
