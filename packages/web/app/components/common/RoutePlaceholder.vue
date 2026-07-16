<template>
	<UContainer class="py-2">
		<UCard
			class="relative overflow-hidden rounded-2xl border-primary/25 bg-linear-to-br from-primary/15 via-card to-card"
		>
			<div class="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
			<div class="relative max-w-2xl">
				<span class="grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
					<TablerIcon :name="icon" class="size-6" />
				</span>
				<h1 class="mt-5 text-4xl font-black">{{ title }}</h1>
				<p class="mt-3 text-lg text-muted-foreground">{{ description }}</p>
				<UButton :to="backTo" class="mt-6" color="primary" variant="soft">
					<TablerIcon name="chevron-left" class="size-4" />
					{{ backLabel }}
				</UButton>
			</div>
		</UCard>
	</UContainer>
</template>

<script setup lang="ts">
import type { TablerIconName } from '~/utils/icons'

defineProps<{
	title: string
	description: string
	backTo: string
	backLabel: string
	icon: TablerIconName
}>()
</script>
