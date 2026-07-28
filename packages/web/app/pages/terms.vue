<template>
	<LegalDocument
		v-if="document"
		:eyebrow="$t('pages.terms.eyebrow')"
		:title="$t('pages.terms.title')"
		:description="$t('pages.terms.description')"
		:document="document"
	/>
</template>

<script setup vapor lang="ts">
const { t } = useI18n()
const { data: document } = await useAsyncData('legal-terms', () =>
	queryCollection('legal').path('/legal/terms').first(),
)

if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.terms.notFound') })
}

usePageSeo('terms')
defineOgImage('Terms.takumi', { slug: 'terms' })
</script>
