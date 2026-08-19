<script setup vapor lang="ts">
import type { LevelSummary } from '~/types/app'

const props = withDefaults(
	defineProps<{
		level: LevelSummary
		size?: 'sm' | 'md' | 'lg'
	}>(),
	{ size: 'md' },
)

const session = useSessionStore()
const favouriteState = useLevelFavouriteState()
const toast = useToast()
const { t } = useI18n()
const target = computed(() =>
	session.user
		? {
				id: props.level.id,
				xxHash: props.level.xxHash,
				favourited: props.level.favourited,
				userId: session.user.id,
			}
		: null,
)

watch(
	target,
	(value) => {
		if (value) favouriteState.initialize(value)
	},
	{ immediate: true },
)

const favourited = computed(() =>
	target.value ? favouriteState.isFavourited(target.value) : false,
)
const pending = computed(() => (target.value ? favouriteState.isPending(target.value) : false))
const accessibleLabel = computed(() =>
	favourited.value
		? t('favourites.actions.remove', { level: props.level.name })
		: t('favourites.actions.add', { level: props.level.name }),
)

async function toggle() {
	if (!target.value) return
	try {
		await favouriteState.toggle(target.value)
	} catch {
		toast.add({
			title: t('favourites.toasts.failed.title'),
			description: t('favourites.toasts.failed.description'),
			color: 'error',
		})
	}
}
</script>

<template>
	<UButton
		v-if="session.user"
		color="neutral"
		variant="soft"
		:loading="pending"
		:disabled="pending"
		:size="size"
		square
		:aria-label="accessibleLabel"
		:title="accessibleLabel"
		class="shrink-0 text-pink-500 hover:bg-pink-500/15 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300"
		@click.prevent.stop="toggle"
	>
		<TablerIcon v-if="!pending" :name="favourited ? 'heart-off' : 'heart'" />
	</UButton>
</template>
