<template>
	<OgFrame
		eyebrow="Legal"
		:title="content.title"
		:description="content.description"
		style="font-family: DINish"
	>
		<OgBreadcrumbs :items="content.breadcrumbs" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
const props = defineProps<{
	slug: string
}>()

const content = await useOgLegalContentData(props.slug, 'privacy')
</script>
