<template>
	<NuxtLink
		:to="action.href"
		:external="action.external"
		:target="action.external ? '_blank' : undefined"
		class="group flex items-center gap-3 rounded-xl border p-3 transition duration-300 hover:-translate-y-0.5"
		:class="
			action.primary
				? 'border-primary/50 bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:bg-primary/90'
				: 'border-border bg-background/55 hover:border-primary/45 hover:bg-primary/10'
		"
	>
		<span
			class="grid size-10 shrink-0 place-items-center rounded-lg"
			:class="action.primary ? 'bg-black/10' : 'bg-primary/15 text-primary'"
		>
			<TablerIcon :name="action.icon" class="size-5" />
		</span>
		<span class="min-w-0 grow">
			<span class="block font-bold">{{ action.label }}</span>
			<span v-if="action.description" class="mt-0.5 block text-xs opacity-75">
				{{ action.description }}
			</span>
		</span>
		<TablerIcon
			:name="action.external ? 'external-link' : 'arrow-right'"
			class="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
		/>
	</NuxtLink>
</template>

<script setup lang="ts">
import type { HeroAction } from '~/types/app'

defineProps<{ action: HeroAction }>()
</script>
