<template>
	<nav :aria-label="label">
		<ol class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
			<li v-for="(item, index) in items" :key="`${item.label}-${index}`" class="flex items-center gap-1.5">
				<TablerIcon v-if="index > 0" name="chevron-right" class="size-4 shrink-0 opacity-60" />
				<NuxtLink
					v-if="item.to"
					:to="item.to"
					class="rounded-md px-1.5 py-1 font-semibold transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
				>
					{{ item.label }}
				</NuxtLink>
				<span v-else class="px-1.5 py-1 font-semibold text-highlighted" aria-current="page">
					{{ item.label }}
				</span>
			</li>
		</ol>
	</nav>
</template>

<script setup vapor lang="ts">
defineProps<{
	label: string
	items: Array<{ label: string; to?: string }>
}>()
</script>
