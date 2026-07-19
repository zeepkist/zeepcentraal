<template>
	<ContentPage
		v-if="document"
		:breadcrumbs="breadcrumbs"
		:breadcrumb-label="$t('common.breadcrumbs')"
		:document="document"
		:table-of-contents-title="$t('common.tableOfContents')"
		show-table-of-contents
	/>
</template>

<script setup lang="ts">
import { modkistReleasesKey } from '~/composables/useModkistReleasesContext'
import type { ModkistReleases } from '~/types/modkist'

const route = useRoute()
const { t } = useI18n()
const slugSegments = computed(() => {
	const slug = route.params.slug
	return Array.isArray(slug) ? slug : [String(slug)]
})
const breadcrumbs = computed(() =>
	buildAncestorBreadcrumbs('/wiki', t('pages.wiki.breadcrumb'), slugSegments.value),
)
const path = computed(
	() => `/wiki/${slugSegments.value.join('/')}`,
)
const { data: document } = await useAsyncData(
	() => `wiki-${path.value}`,
	() => queryCollection('wiki').path(path.value).first(),
)

const isSetupPage = computed(() => path.value === '/wiki/setup-modkist')
const releaseQuery = await useFetch<ModkistReleases>('/api/modkist/releases', {
	key: 'modkist-releases',
	immediate: isSetupPage.value,
	server: isSetupPage.value,
})
provide(modkistReleasesKey, readonly(releaseQuery.data))
if (import.meta.client) {
	watch(isSetupPage, (selected) => {
		if (selected && !releaseQuery.data.value && releaseQuery.status.value !== 'pending') {
			void releaseQuery.execute()
		}
	})
}
if (!document.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.wiki.notFound') })
}
useSeoMeta({ title: () => document.value?.title, description: () => document.value?.description })
</script>
