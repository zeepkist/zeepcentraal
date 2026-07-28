<template>
	<OgFrame
		dense
		style="font-family: DINish"
		:eyebrow="$t('pages.mods.eyebrow')"
		:title="mod?.name ?? $t('mods.detail.notFound')"
		:description="description"
		:image-url="mod?.imageUrl ?? undefined"
	>
		<OgMetrics compact :items="metrics" />
	</OgFrame>
</template>

<script setup vapor lang="ts">
import type { ModDetailResponse } from '~/types/mod'
import { normalizeModSlug } from '~/utils/modExplorer'

const props = defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const modSlug = normalizeModSlug(props.slug)
const { data } = await useFetch<ModDetailResponse>(
	`/api/modio/mods/${modSlug || '__invalid__'}`,
	{
		key: `og-mod-detail:${modSlug || 'invalid'}`,
	},
)
const mod = data.value?.mod
const description = mod
	? t('mods.detail.seoDescription', { name: mod.name })
	: t('pages.mods.seo.description')
const metrics = [
	{ label: t('mods.card.version'), value: mod?.version ?? t('common.unavailable') },
	{ label: t('mods.card.downloads'), value: number.format(mod?.downloads ?? 0) },
	{ label: t('mods.detail.subscribers'), value: number.format(mod?.subscribers ?? 0) },
	{
		label: t('mods.card.rating'),
		value: mod?.rating == null ? t('common.unavailable') : `${number.format(mod.rating)}%`,
	},
]
</script>
