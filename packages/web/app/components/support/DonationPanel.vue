<script setup vapor lang="ts">
defineProps<{
	id: string
	title: string
	description: string
	benefits: { text: string; supported: boolean }[]
	notice: string
	embedUrl: string
	kofiUrl: string
	linkLabel: string
}>()
</script>

<template>
	<section :aria-labelledby="`${id}-title`" class="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
		<h2 :id="`${id}-title`" class="text-2xl font-bold text-highlighted">{{ title }}</h2>
		<p class="mt-2 text-muted-foreground">{{ description }}</p>
		<ul class="mt-5 space-y-3 text-sm leading-6">
			<li v-for="benefit in benefits" :key="benefit.text" class="flex items-start gap-2">
				<TablerIcon
					:name="benefit.supported ? 'circle-check-filled' : 'circle-x-filled'"
					class="mt-0.5 size-5 shrink-0"
					:class="benefit.supported ? 'text-success' : 'text-error'"
					aria-hidden="true"
				/>
				<span>{{ benefit.text }}</span>
			</li>
		</ul>
		<p class="mt-5 rounded-lg bg-muted/60 p-3 text-sm leading-6">{{ notice }}</p>
		<UButton :to="kofiUrl" target="_blank" rel="noopener noreferrer" icon="i-tabler-external-link" color="primary" variant="solid" block class="my-5">{{ linkLabel }}</UButton>
		<iframe :id="id" :src="embedUrl" :title="title" height="712" loading="lazy" style="border:none;width:100%;padding:4px;background:#f9f9f9;" class="rounded-lg" />
	</section>
</template>
