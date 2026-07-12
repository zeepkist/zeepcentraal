<template>
	<header class="mb-6 flex flex-col gap-4 border-b border-border pb-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="max-w-3xl">
				<p v-if="eyebrow" class="text-sm font-semibold uppercase tracking-wide text-primary">
					{{ eyebrow }}
				</p>
				<h1 class="mt-2 text-3xl font-bold text-foreground md:text-4xl">
					{{ title }}
				</h1>
				<p class="mt-3 text-base text-muted-foreground md:text-lg">
					{{ description }}
				</p>
			</div>
			<slot name="actions" />
		</div>
	</header>
</template>

<script setup lang="ts">
defineProps<{
	eyebrow?: string
	title: string
	description: string
}>()
</script>
