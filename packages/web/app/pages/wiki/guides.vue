<template>
	<PagePlaceholder
		page-key="guides"
		icon="book"
		:breadcrumbs="breadcrumbs"
		:breadcrumb-label="$t('common.breadcrumbs')"
	/>
</template>

<script setup lang="ts">
const { t } = useI18n()
const breadcrumbs = computed(() =>
	buildAncestorBreadcrumbs('/wiki', t('pages.wiki.breadcrumb'), ['guides']),
)
usePageSeo('guides')
</script>
