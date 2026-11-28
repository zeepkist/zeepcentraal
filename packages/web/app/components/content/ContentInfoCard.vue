<template>
	<div
		class="group block rounded-xl"
	>
		<UCard
			class="h-full rounded-xl border-border bg-linear-to-br from-card via-card/95 to-primary/5"
		>
			<div class="flex h-full items-start gap-4">
				<span v-if="icon" class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
					<TablerIcon :name="icon" class="size-6" />
				</span>
				<div class="min-w-0 flex-1">
					<h2 class="font-bold text-highlighted transition">
						{{ title }}
					</h2>
					<p class="mt-1 text-sm leading-6 text-muted-foreground">{{ description }}</p>
				</div>
			</div>
		</UCard>
	</div>
</template>

<script setup lang="ts">
import type { TablerIconName } from '~/utils/icons'

const props = defineProps<{
	description: string
	icon?: TablerIconName|undefined
	title: string
}>()

</script>
