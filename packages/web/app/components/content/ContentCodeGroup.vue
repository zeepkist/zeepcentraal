<template>
	<div class="not-prose my-6 overflow-hidden rounded-xl border border-border bg-card/65">
		<UCollapsible :default-open="false" :unmount-on-hide="false">
			<template #default="{ open }">
				<UButton
					color="neutral"
					variant="ghost"
					class="w-full justify-start rounded-none px-4 py-3 text-left hover:bg-primary/5"
				>
					<TablerIcon name="code" class="size-5 shrink-0 text-primary" />
					<span class="min-w-0 flex-1 truncate font-semibold text-highlighted">{{ title }}</span>
					<TablerIcon
						name="chevron-right"
						class="size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none"
						:class="open ? 'rotate-90' : undefined"
					/>
				</UButton>
			</template>

			<template #content>
				<div class="border-t border-border p-4">
					<UTabs
						v-model="activeTab"
						:items="tabs"
						color="primary"
						variant="pill"
						class="w-full"
						:ui="{ content: 'pt-4 outline-none' }"
					>
						<template #curl>
							<div :class="contentClasses"><slot name="curl" /></div>
						</template>
						<template #typescript>
							<div :class="contentClasses"><slot name="typescript" /></div>
						</template>
						<template #python>
							<div :class="contentClasses"><slot name="python" /></div>
						</template>
					</UTabs>
				</div>
			</template>
		</UCollapsible>
	</div>
</template>

<script setup vapor lang="ts">
const props = defineProps<{
	title: string
	curlLabel: string
	pythonLabel: string
	typescriptLabel: string
}>()

const activeTab = ref<'curl' | 'python' | 'typescript'>('curl')
const tabs = computed(() => [
	{ label: props.curlLabel, slot: 'curl' as const, value: 'curl' as const },
	{
		label: props.typescriptLabel,
		slot: 'typescript' as const,
		value: 'typescript' as const,
	},
	{ label: props.pythonLabel, slot: 'python' as const, value: 'python' as const },
])
const contentClasses =
	'space-y-4 text-sm leading-6 text-toned [&_p]:m-0 [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:p-4 [&_code]:text-xs sm:[&_code]:text-sm'
</script>
