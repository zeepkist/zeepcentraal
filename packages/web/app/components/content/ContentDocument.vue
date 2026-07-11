<template>
	<article class="prose prose-slate max-w-none dark:prose-invert prose-a:text-primary">
		<ContentRenderer :value="document" />
	</article>
</template>
<script setup lang="ts">
defineProps<{ document: object }>()
</script>
