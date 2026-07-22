<template>
	<nav :aria-label="$t('tournaments.navigation.title')" class="space-y-4">
		<SectionHeader
			:title="$t('tournaments.navigation.title')"
			:description="$t('tournaments.navigation.description')"
		/>
		<div class="grid gap-5 md:grid-cols-3">
			<div v-for="item in items" :key="item.key" class="flex min-w-0 flex-col gap-2">
				<p class="flex items-center gap-2 text-sm font-bold text-muted-foreground">
					<TablerIcon :name="item.icon" class="size-4" />
					{{ item.label }}
				</p>
				<TournamentCard
					v-if="item.tournament"
					:tournament="item.tournament"
					:to="item.to"
				/>
				<NuxtLink
					v-else-if="item.key === 'current'"
					:to="tournamentPath(type)"
					class="flex h-full min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center transition hover:border-primary/50 hover:bg-primary/5"
				>
					<TablerIcon name="hourglass" class="size-8 text-primary" />
					<p class="mt-3 font-bold text-highlighted">
						{{ $t('tournaments.navigation.noCurrent') }}
					</p>
					<p class="mt-1 text-sm text-muted">
						{{ $t('tournaments.navigation.viewCountdown') }}
					</p>
				</NuxtLink>
				<div
					v-else
					class="flex h-full min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-muted"
				>
					<TablerIcon name="calendar-off" class="size-8" />
					<p class="mt-3 font-semibold">
						{{
							item.key === 'previous'
								? $t('tournaments.navigation.noPrevious')
								: $t('tournaments.navigation.noNext')
						}}
					</p>
				</div>
			</div>
		</div>
	</nav>
</template>

<script setup lang="ts">
import type { TournamentNavigation, TrackTournamentType } from '~/types/tournament'
import { tournamentPath } from '~/utils/tournament'

const props = defineProps<{
	type: TrackTournamentType
	navigation: TournamentNavigation
}>()
const { t } = useI18n()

const items = computed(() => [
	{
		key: 'previous' as const,
		label: t('tournaments.navigation.previous'),
		icon: 'arrow-left',
		tournament: props.navigation.previous,
		to: props.navigation.previous
			? tournamentPath(props.type, props.navigation.previous.slug)
			: undefined,
	},
	{
		key: 'current' as const,
		label: t('tournaments.navigation.current'),
		icon: 'target-arrow',
		tournament: props.navigation.current,
		to: tournamentPath(props.type),
	},
	{
		key: 'next' as const,
		label: t('tournaments.navigation.next'),
		icon: 'arrow-right',
		tournament: props.navigation.next,
		to: props.navigation.next
			? tournamentPath(props.type, props.navigation.next.slug)
			: undefined,
	},
])
</script>
