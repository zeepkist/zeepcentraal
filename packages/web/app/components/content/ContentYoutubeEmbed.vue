<template>
	<figure class="not-prose my-8 space-y-3">
		<div class="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
			<iframe
				v-if="embedUrl"
				:src="embedUrl"
				:title="title"
				class="size-full"
				loading="lazy"
				referrerpolicy="strict-origin-when-cross-origin"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
				allowfullscreen
			/>
		</div>
		<figcaption class="text-center text-sm text-muted-foreground">
			<NuxtLink
				:to="watchUrl"
				external
				target="_blank"
				rel="noopener noreferrer"
				class="font-medium text-primary underline underline-offset-4"
			>
				{{ $t('wikiContent.youtube.open') }}
			</NuxtLink>
		</figcaption>
	</figure>
</template>

<script setup vapor lang="ts">
const props = defineProps<{
	title: string
	videoId: string
}>()

const safeVideoId = computed(() => (/^[A-Za-z0-9_-]{11}$/.test(props.videoId) ? props.videoId : ''))
const embedUrl = computed(() =>
	safeVideoId.value ? `https://www.youtube-nocookie.com/embed/${safeVideoId.value}` : null,
)
const watchUrl = computed(() =>
	safeVideoId.value
		? `https://www.youtube.com/watch?v=${safeVideoId.value}`
		: 'https://www.youtube.com/',
)
</script>
