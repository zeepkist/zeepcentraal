<template>
	<UCard
		class="relative overflow-hidden rounded-xl border-primary/30 bg-linear-to-br from-primary/15 via-card to-card"
	>
		<div class="absolute -right-12 -top-12 size-32 rounded-full bg-primary/15 blur-3xl" />
		<div class="relative space-y-4">
			<div class="flex items-start gap-3">
				<span
					class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"
				>
					<TablerIcon name="package" class="size-5" />
				</span>
				<div class="min-w-0">
					<p class="text-xs font-bold uppercase tracking-[0.16em] text-primary">
						{{ eyebrow }}
					</p>
					<h2 class="mt-1 text-lg font-black leading-tight text-highlighted">{{ title }}</h2>
				</div>
			</div>

			<p class="text-sm leading-relaxed text-muted-foreground">{{ description }}</p>

			<div class="grid gap-2">
				<UButton
					:to="downloadHref"
					external
					target="_blank"
					rel="noopener noreferrer"
					color="primary"
					block
				>
					<TablerIcon name="download" class="size-4" />
					{{ downloadLabel }}
				</UButton>
				<UButton :to="guideHref" color="neutral" variant="soft" block>
					<TablerIcon name="book" class="size-4" />
					{{ guideLabel }}
				</UButton>
			</div>
		</div>
	</UCard>
</template>

<script setup vapor lang="ts">
defineProps<{
	eyebrow: string
	title: string
	description: string
	downloadLabel: string
	downloadHref: string
	guideLabel: string
	guideHref: string
}>()
</script>
