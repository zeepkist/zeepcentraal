<template>
	<USidebar
		v-model:open="open"
		collapsible="icon"
		rail
		class="[--sidebar-width:17rem]"
		data-testid="app-sidebar"
		:ui="{
			inner: 'bg-warm-neutral-900 divide-transparent',
			body: 'gap-1 p-3',
		}"
	>
		<template #header="{ state }">
			<AppLogo v-if="state === 'expanded'" />
			<UTooltip :text="$t(open ? 'actions.sidebarCollapse' : 'actions.sidebarExpand')" :content="{ side: 'right' }">
				<button
					type="button"
					class="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
					:aria-label="$t(open ? 'actions.sidebarCollapse' : 'actions.sidebarExpand')"
					@click="toggleSidebar"
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
					:class="{
						'justify-center px-2': state === 'collapsed',
						'bg-muted text-primary': isNavigationTargetActive(route.path, item.to),
					}"
					:aria-current="isNavigationTargetActive(route.path, item.to) ? 'location' : undefined"
				>
					<TablerIcon :name="item.icon ?? 'dashboard'" class="size-5 shrink-0" />
					<span v-if="state === 'expanded'" class="min-w-0">
						<span class="block truncate font-medium">{{ $t(item.labelKey) }}</span>
					</span>
				</NuxtLink>
			</UTooltip>
		</template>
	</USidebar>
</template>

<script setup vapor lang="ts">
import { isNavigationTargetActive, mainNav } from '~/utils/navigation'
import { parseSidebarOpenPreference } from '~/utils/sidebarPreference'

const route = useRoute()
const sidebarPreference = useCookie<boolean | null>('sidebar-open', {
	default: () => null,
	maxAge: 60 * 60 * 24 * 365,
	path: '/',
	sameSite: 'lax',
})
const open = ref(sidebarPreference.value ?? true)

watch(open, (value) => {
	sidebarPreference.value = value
})

const toggleSidebar = () => {
	open.value = !open.value
}
</script>
