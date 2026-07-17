<template>
	<div class="grid gap-4 md:grid-cols-2">
		<NuxtLink
			v-for="item in items"
			:key="item.id"
			:to="item.url"
			external
			target="_blank"
			rel="noopener"
			class="group flex min-h-48 flex-col rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 p-5 transition duration-300 hover:border-primary/50 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-1"
		>
			<div class="flex items-start justify-between gap-3">
				<span
					v-if="item.author"
					class="truncate text-xs font-semibold uppercase tracking-wider text-primary"
				>
					{{ item.author }}
				</span>
				<span v-else aria-hidden="true" />
				<TablerIcon
					name="external-link"
					class="size-5 shrink-0 text-muted-foreground transition duration-300 group-hover:text-primary motion-safe:group-hover:translate-x-1 motion-safe:group-hover:-translate-y-1"
				/>
			</div>

			<h3 class="mt-4 text-lg font-bold transition-colors group-hover:text-primary">
				{{ item.title }}
			</h3>
			<p class="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
				{{ item.contents }}
			</p>

			<p class="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
				<TablerIcon name="calendar" class="size-4 text-primary/80" />
				<NuxtTime :datetime="item.date" relative />
			</p>
		</NuxtLink>
	</div>
</template>

<script setup lang="ts">
import type { SteamNewsItem } from '~/types/app'

defineProps<{ items: SteamNewsItem[] }>()
</script>
