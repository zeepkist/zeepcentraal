<template>
	<UCard class="relative overflow-hidden rounded-2xl border-primary/25 bg-linear-to-br from-primary/15 via-card to-card">
		<div class="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
		<div v-if="pending" class="relative grid min-h-48 animate-pulse gap-6 lg:grid-cols-[1fr_auto] lg:items-center" aria-busy="true">
			<div class="space-y-4">
				<USkeleton class="h-12 w-3/4" />
				<USkeleton class="h-6 w-full max-w-2xl" />
			</div>
			<div class="space-y-3 lg:w-72">
				<USkeleton class="h-11 w-full" />
				<USkeleton class="h-11 w-full" />
			</div>
		</div>
		<div v-else class="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
			<div>
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
	title: string
	description: string
	actions: Array<{ label: string; href: string; icon: string; external?: boolean }>
	pending?: boolean
}>()
</script>
