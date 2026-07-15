<template>
	<UButton
		v-if="href"
		:to="href"
		target="_blank"
		rel="noopener noreferrer"
		color="neutral"
		variant="soft"
	>
		<TablerIcon name="edit" class="size-4" />
		{{ $t('wikiContent.edit') }}
		<TablerIcon name="external-link" class="size-4 opacity-70" />
	</UButton>
</template>

<script setup lang="ts">
const CONTENT_SOURCE_BASE_URL =
	'https://github.com/zeepkist/zeepcentraal/blob/develop/packages/web/content/'
const SAFE_CONTENT_PATH = /^wiki\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

const props = defineProps<{ path: string }>()
const href = computed(() =>
	SAFE_CONTENT_PATH.test(props.path) ? new URL(props.path, CONTENT_SOURCE_BASE_URL).toString() : null,
)
</script>
