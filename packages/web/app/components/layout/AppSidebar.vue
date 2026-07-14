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
					:class="{ 'justify-center px-2': state === 'collapsed' }"
					active-class="bg-muted text-primary"
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

<script setup lang="ts">
import { mainNav } from '~/utils/navigation'
import { parseSidebarOpenPreference } from '~/utils/sidebarPreference'

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

onMounted(() => {
	if (sidebarPreference.value !== null) return
	const legacyPreference = parseSidebarOpenPreference(localStorage.getItem('sidebar-open'))
	if (legacyPreference === null) return
	open.value = legacyPreference
	localStorage.removeItem('sidebar-open')
})

const toggleSidebar = () => {
	open.value = !open.value
}
</script>
