<template>
	<component
		:is="component"
		v-bind="linkProps"
		class="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
	>
		<UCard
			class="h-full rounded-xl border-border bg-gradient-to-br from-card via-card/95 to-primary/5 transition duration-300 group-hover:border-primary/50 motion-safe:group-hover:-translate-y-1"
		>
			<div class="flex h-full items-start gap-4">
				<span class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
					<TablerIcon :name="icon" class="size-6" />
				</span>
				<div class="min-w-0 flex-1">
					<h2 class="font-bold text-highlighted transition group-hover:text-primary">
						{{ title }}
					</h2>
					<p class="mt-1 text-sm leading-6 text-muted-foreground">{{ description }}</p>
				</div>
				<TablerIcon
					:name="external ? 'external-link' : 'arrow-right'"
					class="mt-1 size-5 shrink-0 text-muted-foreground transition group-hover:text-primary motion-safe:group-hover:translate-x-1"
				/>
			</div>
		</UCard>
	</component>
</template>

<script setup lang="ts">
import type { TablerIconName } from '~/utils/icons'

const props = defineProps<{
	description: string
	external?: boolean
	icon: TablerIconName
	title: string
	to: string
}>()

const nuxtLink = resolveComponent('NuxtLink')
const component = computed(() => (props.external ? 'a' : nuxtLink))
const linkProps = computed(() =>
	props.external
		? { href: props.to, rel: 'noopener', target: '_blank' }
		: { to: props.to },
)
</script>
