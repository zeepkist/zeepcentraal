<template>
	<OgFrame
		dense
		style="font-family: DINish"
		:eyebrow="$t('pages.mods.eyebrow')"
		:title="$t('pages.mods.title')"
		:description="$t('pages.mods.description')"
	>
		<div class="flex min-h-0 flex-col gap-3 overflow-hidden">
			<OgMetrics compact :items="metrics" />
			<div class="flex min-h-0 gap-3 overflow-hidden">
				<div
					v-for="mod in popularMods"
					:key="mod.id"
					class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border border-[#292524] bg-[#171513] p-3"
				>
					<img
						v-if="mod.imageUrl"
						:src="mod.imageUrl"
						alt=""
						class="h-20 w-32 shrink-0 rounded-xl object-cover"
					/>
					<div
						v-else
						class="flex h-20 w-32 shrink-0 items-center justify-center rounded-xl bg-[#292524] text-[18px] font-black text-[#78716c]"
					>
						MOD
					</div>
					<div class="max-h-14 min-w-0 overflow-hidden text-[22px] font-black leading-tight">
						{{ mod.name }}
					</div>
				</div>
			</div>
		</div>
	</OgFrame>
</template>

<script setup vapor lang="ts">
import type { ModListResponse } from '~/types/mod'
import { normaliseOgImageUrl } from '~/utils/ogImage'

const props = defineProps<{ slug: string }>()

const { locale, t } = useI18n()
const number = getNumberFormatter(locale.value)
const { data } = await useFetch<ModListResponse>('/api/modio/mods', {
	key: `og-mod-explorer:${props.slug}`,
})
const metrics = [
	{
		label: t('nav.mods'),
		value: number.format(data.value?.total ?? 0),
	},
]
const popularMods = (data.value?.items ?? []).slice(0, 3).map((mod) => ({
	id: mod.id,
	imageUrl: normaliseOgImageUrl(mod.imageUrl),
	name: mod.name,
}))
</script>
