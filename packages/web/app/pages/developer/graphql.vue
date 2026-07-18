<template>
	<ContentPage
		v-if="document"
		:breadcrumbs="breadcrumbs"
		:breadcrumb-label="$t('common.breadcrumbs')"
		:document="document"
		:table-of-contents-title="$t('pages.graphql.tableOfContents')"
		show-table-of-contents
	/>
</template>
<script setup lang="ts">
const { t } = useI18n()
const breadcrumbs = computed(() =>
	buildAncestorBreadcrumbs('/developer', t('pages.developer.breadcrumb'), ['graphql']),
)
usePageSeo('graphql')
const { data: document } = await useAsyncData('developer-graphql', () =>
	queryCollection('developer').path('/developer/graphql').first(),
)

if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.graphql.notFound') })
}
</script>
