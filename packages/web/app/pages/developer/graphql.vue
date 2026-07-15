<template>
	<ContentPage
		v-if="document"
		:eyebrow="$t('pages.graphql.eyebrow')"
			:document="document"
			:table-of-contents-title="$t('pages.graphql.tableOfContents')"
			show-table-of-contents
	/>
</template>
<script setup lang="ts">
const { t } = useI18n()
usePageSeo('graphql')
const { data: document } = await useAsyncData('developer-graphql', () =>
	queryCollection('developer').path('/developer/graphql').first(),
)

if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.graphql.notFound') })
}
</script>
