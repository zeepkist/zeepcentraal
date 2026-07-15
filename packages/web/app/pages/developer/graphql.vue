<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="$t('pages.graphql.eyebrow')" :title="$t('pages.graphql.title')" :description="$t('pages.graphql.description')" />
		<ContentDocument
			v-if="document"
			:document="document"
			:table-of-contents-title="$t('pages.graphql.tableOfContents')"
			show-table-of-contents
		/>
	</UContainer>
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
