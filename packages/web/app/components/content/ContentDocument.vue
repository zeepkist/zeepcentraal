<template>
	<div :class="hasTableOfContents ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start' : undefined">
		<article
			class="prose prose-slate max-w-none min-w-0 dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-highlighted prose-h2:border-b prose-h2:border-border prose-h2:pb-3 prose-a:font-medium prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-highlighted prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-border prose-pre:bg-elevated prose-th:text-highlighted prose-td:border-border prose-th:border-border"
			:class="hasTableOfContents ? 'order-2 lg:order-1' : undefined"
		>
			<ContentRenderer :value="document" />
		</article>

		<aside
			v-if="hasTableOfContents"
			class="order-1 min-w-0 overflow-hidden rounded-xl border border-border bg-card/65 p-4 lg:order-2 lg:sticky lg:top-24"
		>
			<UContentToc
				:title="tableOfContentsTitle"
				:links="tocLinks"
				highlight
				highlight-color="primary"
				:default-open="false"
				class="w-full min-w-0"
				:ui="{
					root: '!static !mx-0 !max-h-none !min-w-0 !overflow-hidden !bg-transparent !px-0 !backdrop-blur-none',
					container: '!border-0 !p-0',
					content: 'min-w-0 max-w-full overflow-hidden',
					list: 'min-w-0 max-w-full',
					listWithChildren: 'min-w-0 max-w-full',
					link: 'min-w-0 max-w-full',
					linkText: 'truncate',
				}"
			/>
		</aside>
	</div>
</template>

<script setup lang="ts">
import type { TocLink } from '@nuxt/content'

type ContentValue = object & {
	body?: {
		toc?: {
			links?: TocLink[]
		}
	}
}

const props = defineProps<{
	document: ContentValue
	showTableOfContents?: boolean
	tableOfContentsTitle?: string
}>()

const tocLinks = computed(() => props.document.body?.toc?.links ?? [])
const hasTableOfContents = computed(
	() => Boolean(props.showTableOfContents && tocLinks.value.length),
)
</script>
