<template>
	<nav :aria-label="label">
		<ol class="flex flex-wrap items-center gap-1 text-sm font-semibold uppercase tracking-wide text-primary">
			<li v-for="(item, index) in items" :key="item.to" class="flex min-w-0 items-center gap-1">
				<TablerIcon
					v-if="index > 0"
					name="chevron-right"
					class="size-4 shrink-0 opacity-50"
				/>
				<NuxtLink
					:to="item.to"
					class="truncate rounded-md px-1 py-0.5 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					{{ item.label }}
				</NuxtLink>
			</li>
		</ol>
	</nav>
</template>

<script setup lang="ts">
import type { ContentBreadcrumb } from '~/utils/contentBreadcrumbs'

defineProps<{
	items: ContentBreadcrumb[]
	label: string
}>()
</script>
