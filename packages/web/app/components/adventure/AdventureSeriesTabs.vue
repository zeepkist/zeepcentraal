<template>
	<nav :aria-label="label">
		<div class="flex flex-wrap gap-2" role="tablist">
			<UButton id="adventure-series-global" to="/adventure" :prefetch="false" role="tab" :aria-selected="activeSlug === undefined" aria-controls="adventure-series-panel" :color="activeSlug === undefined ? 'primary' : 'neutral'" :variant="activeSlug === undefined ? 'solid' : 'soft'">{{ globalLabel }}</UButton>
			<UButton
				v-for="item in series"
				:key="item.slug"
				:id="`adventure-series-${item.slug}`"
				:to="`/adventure/${item.slug}`"
				:prefetch="false"
				role="tab"
				:aria-selected="activeSlug === item.slug"
				aria-controls="adventure-series-panel"
				:color="activeSlug === item.slug ? 'primary' : 'neutral'"
				:variant="activeSlug === item.slug ? 'solid' : 'soft'"
				class="shrink-0"
			>
				{{ item.label }}
				<UBadge
					:color="activeSlug === item.slug ? 'neutral' : 'primary'"
					variant="soft"
					size="sm"
				>
					{{ item.count == null ? unavailableLabel : number.format(item.count) }}
				</UBadge>
			</UButton>
		</div>
	</nav>
</template>

<script setup lang="ts">
import type { AdventureSeriesDefinition } from '~/utils/adventureSeries'

defineProps<{
	series: Array<AdventureSeriesDefinition & { count?: number; label: string }>
	activeSlug?: string
	label: string
	globalLabel: string
	unavailableLabel: string
}>()

const { locale } = useAppI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
</script>
