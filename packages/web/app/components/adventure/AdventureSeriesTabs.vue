<template>
	<nav :aria-label="label">
		<div class="flex flex-wrap gap-2" role="tablist">
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

<script setup vapor lang="ts">
import type { AdventureSeriesDefinition } from '~/utils/adventureSeries'

defineProps<{
	series: Array<AdventureSeriesDefinition & { count?: number; label: string }>
	activeSlug?: string
	label: string
	unavailableLabel: string
}>()

const { locale } = useI18n()
const number = computed(() => new Intl.NumberFormat(locale.value))
</script>
