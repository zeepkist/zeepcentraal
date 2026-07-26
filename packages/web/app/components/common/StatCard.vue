<template>
	<component
		:is="wrapper"
		:to="to"
		:class="to ? 'group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' : undefined"
	>
	<UCard
		:ui="{ root: 'rounded-lg border-border bg-card/80' }"
		:class="to ? 'transition group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/5 motion-safe:group-hover:-translate-y-1' : undefined"
	>
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0 flex-1">
				<p class="text-sm text-muted-foreground">
					{{ label }}
				</p>
				<p :aria-label="valueLabel" class="tabular mt-2 text-3xl font-bold">
					<slot name="value">{{ value }}</slot>
				</p>
				<dl v-if="details?.length" class="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
					<div v-for="detail in details" :key="detail.label" class="min-w-0">
						<dt class="truncate text-xs text-muted-foreground">
							{{ detail.label }}
						</dt>
						<dd class="tabular mt-1 font-semibold">
							{{ detail.value }}
						</dd>
					</div>
				</dl>
			</div>
			<div class="rounded-md bg-primary/10 p-2 text-primary">
				<TablerIcon :name="icon" />
			</div>
		</div>
	</UCard>
	</component>
</template>

<script setup vapor lang="ts">
import type { TablerIconName } from '~/utils/icons'

const props = defineProps<{
	label: string
	value?: string
	valueLabel?: string
	icon: TablerIconName
	details?: Array<{ label: string; value: string }>
	to?: string
}>()

const wrapper = computed(() => (props.to ? resolveComponent('NuxtLink') : 'div'))
</script>
