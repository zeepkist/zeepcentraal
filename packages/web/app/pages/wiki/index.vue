<template>
	<ContentPage
		v-if="document"
		:document="document"
		:table-of-contents-title="$t('common.tableOfContents')"
		show-table-of-contents
	/>
</template>
<script setup vapor lang="ts">
usePageSeo('wiki')
const { data: document } = await useAsyncData('wiki-index', () =>
	queryCollection('wiki').path('/wiki').first(),
)
</script>
