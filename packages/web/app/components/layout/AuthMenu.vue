<template>
	<UDropdownMenu :items="items" :content="{ align: 'end' }">
		<UButton
			color="neutral"
			variant="ghost"
			size="sm"
			square
			:aria-label="user ? labels.account : labels.signIn"
		>
			<TablerIcon :name="user ? 'user-circle' : 'login'" />
		</UButton>

		<template #profile-leading><TablerIcon name="user" class="size-4" /></template>
		<template #settings-leading><TablerIcon name="settings" class="size-4" /></template>
		<template #language-leading><TablerIcon name="world" class="size-4" /></template>
		<template #logout-leading><TablerIcon name="logout" class="size-4" /></template>
		<template #steam-leading><TablerIcon name="brand-steam" class="size-4" /></template>
		<template #discord-leading><TablerIcon name="brand-discord" class="size-4" /></template>
	</UDropdownMenu>
</template>

<script setup vapor lang="ts">
import type { LocaleOption, SessionUser } from '~/types/app'
import { type AccountMenuLabels, buildAccountMenuItems } from '~/utils/account-menu'

const props = defineProps<{
	user: SessionUser | null
	locale: string
	localeOptions: LocaleOption[]
	labels: AccountMenuLabels
}>()
const emit = defineEmits<{
	locale: [code: string]
	logout: []
	steam: []
	discord: []
}>()
const items = computed(() =>
	buildAccountMenuItems({
		...props,
		onLocale: (code) => emit('locale', code),
		onLogout: () => emit('logout'),
		onSteam: () => emit('steam'),
		onDiscord: () => emit('discord'),
	}),
)
</script>
