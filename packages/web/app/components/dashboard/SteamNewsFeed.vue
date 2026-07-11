<template>
	<UCard class="rounded-xl border-border bg-card/85">
		<div class="mb-4">
			<h2 class="text-xl font-semibold">{{ title }}</h2>
			<p class="text-sm text-muted-foreground">{{ description }}</p>
		</div>
		<div class="grid gap-3">
			<article v-for="item in items" :key="item.id" class="rounded-lg border border-border bg-muted/30 p-4">
				<div class="flex items-start justify-between gap-3">
					<h3 class="font-semibold"><a :href="item.url" target="_blank" rel="noopener" class="hover:text-primary">{{ item.title }}</a></h3>
					<TablerIcon name="brand-steam" class="text-muted-foreground" />
				</div>
				<p class="mt-2 line-clamp-2 text-sm text-muted-foreground">{{ item.contents }}</p>
				<p class="mt-3 text-xs text-muted-foreground"><NuxtTime :datetime="item.date" relative /></p>
			</article>
		</div>
	</UCard>
</template>

<script setup lang="ts">
import type { SteamNewsItem } from '~/types/app'

defineProps<{ title: string; description: string; items: SteamNewsItem[] }>()
</script>
