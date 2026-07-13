<template>
	<UCard
		class="relative overflow-hidden rounded-2xl border-primary/30 bg-linear-to-br from-primary/15 via-card to-card"
	>
		<div class="hero-orbit absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" />
		<div class="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
			<div class="flex gap-4">
				<span class="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
					<TablerIcon name="plug-connected" class="size-6" />
				</span>
				<div>
					<h2 class="text-2xl font-black">{{ title }}</h2>
					<p class="mt-2 max-w-2xl text-muted-foreground">{{ description }}</p>
				</div>
			</div>
			<UButton :to="href" color="primary" size="xl">
				<TablerIcon name="shield-check" class="size-5" />
				{{ actionLabel }}
			</UButton>
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	title: string
	description: string
	actionLabel: string
	href: string
}>()
</script>
