<template>
	<UContainer class="space-y-8 py-2">
		<PageHeader :eyebrow="eyebrow" :title="document.title" :description="document.description" />
		<ContentDocument
			:document="document"
			:show-table-of-contents="showTableOfContents"
			:table-of-contents-title="tableOfContentsTitle"
		/>
	</UContainer>
</template>

<script setup lang="ts">
import type { TocLink } from '@nuxt/content'

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
	document: ContentPageDocument
	eyebrow?: string
	showTableOfContents?: boolean
	tableOfContentsTitle?: string
}>()
</script>
