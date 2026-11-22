<script setup lang="ts">
import ZslEditor from '~/components/admin/ZslEditor.vue'

useSeoMeta({ title: 'Super League administration', robots: 'noindex, nofollow' })
</script>

<template>
	<section class="mx-auto max-w-6xl px-4 py-8">
		<h1 class="mb-6 text-2xl font-bold">Super League administration</h1>
		<ZslEditor />
	</section>
</template>
