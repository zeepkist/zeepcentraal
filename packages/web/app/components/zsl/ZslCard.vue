<template>
	<NuxtLink
		:to="to"
		class="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 motion-safe:hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		<div v-if="imageSrc" class="aspect-video overflow-hidden bg-muted">
			<NuxtImg
				:src="imageSrc"
				:alt="imageAlt"
				class="size-full object-cover transition duration-300 motion-safe:group-hover:scale-105"
				loading="lazy"
			/>
		</div>
		<div class="flex flex-1 flex-col p-5">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<slot name="eyebrow" />
					<slot name="title" />
				</div>
				<div class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
					<TablerIcon :name="icon" class="size-5" />
				</div>
			</div>
			<div v-if="$slots.meta" class="mt-4 text-sm text-muted-foreground">
				<slot name="meta" />
			</div>
			<div class="mt-auto flex items-end justify-between gap-4 pt-4">
				<div class="min-w-0 text-sm"><slot name="footer" /></div>
				<TablerIcon
					name="chevron-right"
					class="size-5 shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-1"
				/>
			</div>
		</div>
	</NuxtLink>
</template>

<script setup lang="ts">
defineProps<{
	to: string
	icon: string
	imageSrc?: string | null
	imageAlt?: string
}>()
</script>
