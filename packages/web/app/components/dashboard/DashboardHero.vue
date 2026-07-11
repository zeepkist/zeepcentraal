<template>
	<UCard class="relative overflow-hidden rounded-2xl border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card">
		<div class="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
		<div class="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
			<div>
				<UBadge color="primary" variant="soft">{{ eyebrow }}</UBadge>
				<h1 class="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">{{ title }}</h1>
				<p class="mt-4 max-w-2xl text-lg text-muted-foreground">{{ description }}</p>
			</div>
			<div class="flex flex-wrap gap-3 lg:max-w-xs">
				<UButton v-for="action in actions" :key="action.href" :to="action.href" :external="action.external" :target="action.external ? '_blank' : undefined" color="primary" variant="soft">
					<TablerIcon :name="action.icon" />
					{{ action.label }}
				</UButton>
			</div>
		</div>
	</UCard>
</template>

<script setup lang="ts">
defineProps<{
	eyebrow: string
	title: string
	description: string
	actions: Array<{ label: string; href: string; icon: string; external?: boolean }>
}>()
</script>
