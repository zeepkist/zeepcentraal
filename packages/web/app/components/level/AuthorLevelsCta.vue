<template>
	<section
		v-if="authorId"
		class="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card to-primary/10 p-6 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
	>
		<div class="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="text-xl font-bold text-highlighted">{{ title }}</p>
				<p class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ description }}</p>
			</div>
			<UButton
				:to="{ path: '/levels', query: { author: authorId } }"
				color="primary"
				variant="soft"
				size="lg"
				trailing-icon="i-tabler-arrow-right"
				class="shrink-0 transition-transform motion-safe:group-hover:translate-x-1"
			>
				{{ action }}
			</UButton>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
defineProps<{
	authorId?: string | null
	title: string
	description: string
	action: string
}>()
</script>
