<script setup lang="ts">
import type { Zc_AdventureLeaderboardFragment } from '@zeepkist/graphql/generated'
import { formatAdventureTime } from '~/utils/adventureLeaderboard'

const props = defineProps<{ leaderboard: Zc_AdventureLeaderboardFragment; series?: string }>()
defineEmits<{ viewLevels: [] }>()
const { t } = useAppI18n()
const next = computed(() => props.leaderboard.playerEntry?.nextEntry)
const nextName = computed(() => next.value?.user?.steamName ?? next.value?.user?.steamId ?? '')
const missing = computed(() => (props.leaderboard.totalLevels ?? 0) - (props.leaderboard.playerEntry?.completedLevels ?? 0))
</script>

<template>
	<div class="rounded-xl border border-border bg-card/70 p-4 sm:p-5" data-testid="adventure-progress">
		<h3 class="mb-4 text-sm font-semibold">{{ t('adventure.leaderboard.yourProgress') }}</h3>
		<dl class="grid grid-cols-2 gap-5 text-sm lg:grid-cols-4">
			<div><dt class="text-muted-foreground">{{ t('adventure.leaderboard.rank') }}</dt><dd class="mt-2 font-semibold tabular-nums text-foreground">{{ leaderboard.playerEntry ? `#${leaderboard.playerEntry.rank}` : t('adventure.leaderboard.unranked') }}</dd></div>
			<div><dt class="text-muted-foreground">{{ t('adventure.leaderboard.completed') }}</dt><dd class="mt-2 font-semibold tabular-nums text-foreground">{{ leaderboard.playerEntry?.completedLevels ?? 0 }}/{{ leaderboard.totalLevels }}</dd></div>
			<div><dt class="text-muted-foreground">{{ t('adventure.leaderboard.totalTime') }}</dt><dd class="mt-2 font-semibold tabular-nums text-foreground">{{ formatAdventureTime(leaderboard.playerEntry?.totalTimeMs) }} <span v-if="!leaderboard.playerEntry?.isComplete" class="font-normal text-muted-foreground">{{ t('adventure.leaderboard.partial') }}</span></dd></div>
			<div><dt class="text-muted-foreground">{{ t('adventure.leaderboard.remaining') }}</dt><dd class="mt-2 font-semibold tabular-nums text-foreground">{{ missing }}</dd></div>
		</dl>
		<div v-if="next" class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3 text-sm text-muted-foreground">
			<p v-if="leaderboard.playerEntry?.gapMs != null" class="min-w-0 max-w-full [overflow-wrap:anywhere]">{{ t('adventure.leaderboard.timeGap', { time: formatAdventureTime(leaderboard.playerEntry.gapMs), rank: next.rank, player: nextName, count: leaderboard.playerEntry.completedLevels }) }}</p>
			<p v-else-if="(next.completedLevels ?? 0) > (leaderboard.playerEntry?.completedLevels ?? 0)" class="min-w-0 max-w-full [overflow-wrap:anywhere]">{{ t('adventure.leaderboard.completionGap', { count: (next.completedLevels ?? 0) - (leaderboard.playerEntry?.completedLevels ?? 0), rank: next.rank, player: nextName }) }}</p>
			<UButton v-if="leaderboard.playerEntry" color="neutral" variant="link" class="p-0" @click="$emit('viewLevels')">{{ t('adventure.leaderboard.viewYourLevels') }}</UButton>
		</div>
		<div v-else-if="leaderboard.playerEntry" class="mt-4"><UButton color="neutral" variant="link" class="p-0" @click="$emit('viewLevels')">{{ t('adventure.leaderboard.viewYourLevels') }}</UButton></div>
		<AdventurePlaylistActions class="mt-4" :series="series" :missing-count="missing" authenticated />
	</div>
</template>
