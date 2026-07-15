<template>
	<div class="not-prose my-8 space-y-4">
		<ContentModkistReleasePanel
			channel="stable"
			:release="stable"
			:title="$t('wikiContent.modkist.stable.title')"
			:description="$t('wikiContent.modkist.stable.description')"
			color="success"
		/>
		<ContentModkistReleasePanel
			v-if="prerelease"
			channel="prerelease"
			:release="prerelease"
			:title="$t('wikiContent.modkist.prerelease.title')"
			:description="$t('wikiContent.modkist.prerelease.description')"
			color="warning"
		/>
		<div class="flex flex-wrap gap-2">
			<UButton :to="sourceUrl" target="_blank" rel="noopener noreferrer" color="neutral" variant="soft">
				<TablerIcon name="brand-github" class="size-4" />
				{{ $t('wikiContent.modkist.source') }}
			</UButton>
			<UButton :to="releasesUrl" target="_blank" rel="noopener noreferrer" color="neutral" variant="ghost">
				<TablerIcon name="external-link" class="size-4" />
				{{ $t('wikiContent.modkist.allReleases') }}
			</UButton>
		</div>
	</div>
</template>

<script setup lang="ts">
import { MODKIST_RELEASES_URL, MODKIST_SOURCE_URL } from '~/types/modkist'

const releases = useModkistReleasesContext()
const stable = computed(() => releases.value?.stable ?? null)
const prerelease = computed(() => releases.value?.prerelease ?? null)
const releasesUrl = computed(() => releases.value?.releasesUrl ?? MODKIST_RELEASES_URL)
const sourceUrl = computed(() => releases.value?.sourceUrl ?? MODKIST_SOURCE_URL)
</script>
