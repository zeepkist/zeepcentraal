<template><UContainer class="py-8"><ContentDocument v-if="document" :document="document" /></UContainer></template>
<script setup lang="ts">
const route = useRoute()
const path = computed(
	() =>
		`/wiki/${Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug}`,
)
const { data: document } = await useAsyncData(
	() => `wiki-${path.value}`,
	() => queryCollection('wiki').path(path.value).first(),
)
if (!document.value) throw createError({ statusCode: 404, statusMessage: 'Wiki page not found' })
useSeoMeta({ title: () => document.value?.title, description: () => document.value?.description })
</script>
