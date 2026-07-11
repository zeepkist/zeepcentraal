<template>
	<USidebar
		v-model:open="open"
		collapsible="icon"
		rail
		class="[--sidebar-width:17rem]"
		:ui="{
			inner: 'bg-neutral-500 divide-transparent',
			body: 'gap-1 p-3',
		}"
	>
		<template #header="{ state }">
			<div v-if="state === 'expanded'" class="flex min-w-0 flex-1 items-center gap-3">
				<div class="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
					<span class="text-sm font-black">ZC</span>
				</div>
				<span class="truncate text-sm font-semibold text-highlighted">
					ZeepCentraal
				</span>
			</div>
			<UTooltip :text="$t(open ? 'actions.sidebarCollapse' : 'actions.sidebarExpand')" :content="{ side: 'right' }">
				<button
					type="button"
					class="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
					:aria-label="$t(open ? 'actions.sidebarCollapse' : 'actions.sidebarExpand')"
					@click="open = !open"
				>
					<TablerIcon
						:name="open ? 'sidebar-collapse' : 'sidebar-expand'"
						class="size-5"
					/>
				</button>
			</UTooltip>
		</template>

		<template #default="{ state }">
			<UTooltip
				v-for="item in mainNav"
				:key="item.to"
				:text="$t(item.labelKey)"
				:disabled="state === 'expanded'"
				:content="{ side: 'right' }"
			>
				<NuxtLink
					:to="item.to"
					class="group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
					:class="{ 'justify-center px-2': state === 'collapsed' }"
					active-class="bg-muted text-primary"
				>
					<TablerIcon :name="item.icon ?? 'dashboard'" class="size-5 shrink-0" />
					<span v-if="state === 'expanded'" class="min-w-0">
						<span class="block truncate font-medium">{{ $t(item.labelKey) }}</span>
						<span class="block truncate text-xs text-muted-foreground">
							{{ $t(item.descriptionKey ?? item.labelKey) }}
						</span>
					</span>
				</NuxtLink>
			</UTooltip>
		</template>
	</USidebar>
</template>

<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

import { mainNav } from '~/utils/navigation'

const open = useLocalStorage('sidebar-open', true)
</script>
