<script setup lang="ts">
import type { Zc_AdventureLeaderboardFragment } from '@zeepkist/graphql/generated'
import { formatAdventureTime } from '~/utils/adventureLeaderboard'

defineProps<{ leaderboard: Zc_AdventureLeaderboardFragment }>()
const { t } = useAppI18n()
</script>

<template>
	<UCard>
		<div class="space-y-3">
			<h3 class="font-semibold">{{ t('adventure.leaderboard.yourProgress') }}</h3>
			<div class="flex flex-wrap items-center gap-3 tabular-nums">
				<span>{{ leaderboard.playerEntry ? `#${leaderboard.playerEntry.rank}` : t('adventure.leaderboard.unranked') }}</span>
				<UBadge :color="leaderboard.playerEntry?.isComplete ? 'success' : 'neutral'" size="lg" variant="soft">{{ leaderboard.playerEntry?.completedLevels ?? 0 }}/{{ leaderboard.totalLevels }}</UBadge>
				<span>{{ formatAdventureTime(leaderboard.playerEntry?.totalTimeMs) }} <span v-if="!leaderboard.playerEntry?.isComplete" class="text-muted">{{ t('adventure.leaderboard.partial') }}</span></span>
			</div>
			<p v-if="leaderboard.playerEntry?.gapMs != null" class="text-sm">{{ t('adventure.leaderboard.timeGap', { time: formatAdventureTime(leaderboard.playerEntry.gapMs) }) }}</p>
			<p v-else-if="leaderboard.playerEntry?.nextEntry && (leaderboard.playerEntry.nextEntry.completedLevels ?? 0) > (leaderboard.playerEntry.completedLevels ?? 0)" class="text-sm">{{ t('adventure.leaderboard.completionGap', { count: (leaderboard.playerEntry.nextEntry.completedLevels ?? 0) - (leaderboard.playerEntry.completedLevels ?? 0) }) }}</p>
			<details v-if="leaderboard.missingLevels?.nodes.length" class="text-sm">
				<summary class="cursor-pointer">{{ t('adventure.leaderboard.missingLevels', { count: leaderboard.missingLevels.nodes.length }) }}</summary>
				<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2">
					<li v-for="level in leaderboard.missingLevels.nodes" :key="level.id"><NuxtLink :to="`/level/${level.xxHash}`" class="text-primary hover:underline">{{ level.levelItems.nodes[0]?.name ?? level.xxHash }}</NuxtLink></li>
				</ul>
			</details>
		</div>
	</UCard>
</template>
