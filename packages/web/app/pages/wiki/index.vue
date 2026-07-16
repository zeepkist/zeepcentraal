<template>
	<ContentPage
		v-if="document"
		:document="document"
		:table-of-contents-title="$t('pages.wiki.tableOfContents')"
		show-table-of-contents
	/>
</template>
<script setup lang="ts">
usePageSeo('wiki')
const { data: document } = await useAsyncData('wiki-index', () =>
	queryCollection('wiki').path('/wiki').first(),
)
</script>
