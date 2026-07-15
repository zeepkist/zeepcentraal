<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader
			:breadcrumbs="breadcrumbs"
			:breadcrumb-label="breadcrumbLabel"
			:title="document.title"
			:description="document.description"
		/>
		<ContentDocument
			:document="document"
			:show-table-of-contents="showTableOfContents"
			:table-of-contents-title="tableOfContentsTitle"
		/>
	</UContainer>
</template>

<script setup lang="ts">
import type { TocLink } from '@nuxt/content'
import type { ContentBreadcrumb } from '~/utils/contentBreadcrumbs'

type ContentPageDocument = object & {
	title: string
	description: string
	body?: {
		toc?: {
			links?: TocLink[]
		}
	}
}

defineProps<{
	breadcrumbLabel?: string
	breadcrumbs?: ContentBreadcrumb[]
	document: ContentPageDocument
	showTableOfContents?: boolean
	tableOfContentsTitle?: string
}>()
</script>
