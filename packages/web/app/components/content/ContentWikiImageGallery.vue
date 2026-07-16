<template>
	<div class="not-prose my-8 grid gap-4 md:grid-cols-3">
		<figure v-for="image in images" :key="image.src" class="space-y-2">
			<div class="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
				<NuxtImg
					:src="image.src"
					:alt="image.caption"
					class="size-full object-cover"
					loading="lazy"
				/>
			</div>
			<figcaption class="text-center text-xs text-muted-foreground">
				{{ image.caption }}
			</figcaption>
		</figure>
	</div>
</template>

<script setup lang="ts">
import treeTrickOne from '~/assets/wiki/tree-trick-1.jpg'
import treeTrickTwo from '~/assets/wiki/tree-trick-2.jpg'
import treeTrickThree from '~/assets/wiki/tree-trick-3.jpg'

const props = defineProps<{
	firstCaption: string
	secondCaption: string
	thirdCaption: string
}>()

const images = computed(() => [
	{ src: treeTrickOne, caption: props.firstCaption },
	{ src: treeTrickTwo, caption: props.secondCaption },
	{ src: treeTrickThree, caption: props.thirdCaption },
])
</script>
