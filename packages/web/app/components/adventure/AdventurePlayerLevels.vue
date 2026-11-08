<script setup lang="ts">
import { formatAdventureDelta, formatAdventureTime } from '~/utils/adventureLeaderboard'
import { groupAdventurePlayerLevels } from '~/utils/adventurePlayerLevels'

const props = defineProps<{ series?: string; playerId: number }>()
const { t } = useAppI18n()
const sort = shallowRef<'level' | 'gap'>('level')
const { levels, pending, error, refresh } = useAdventurePlayerLevels(computed(() => props.series), computed(() => props.playerId))
const groups = computed(() => groupAdventurePlayerLevels(levels.value, sort.value))
const options = computed(() => [{ label: t('adventure.leaderboard.levelOrder'), value: 'level' }, { label: t('adventure.leaderboard.largestGap'), value: 'gap' }])
</script>

<template>
	<div class="space-y-3 p-4 sm:p-5" data-testid="adventure-player-levels">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h3 class="font-semibold">{{ t('adventure.leaderboard.levelTimes') }}</h3>
			<USelect v-model="sort" :items="options" :aria-label="t('adventure.leaderboard.sortLevels')" class="w-48" />
		</div>
		<DataState :pending="pending && !levels.length" :error="error" :empty="!levels.length" :loading-label="t('common.loading')" :error-title="t('common.error')" :empty-title="t('common.empty')">
			<!-- biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard access to scrollable results. -->
			<section class="max-h-112 overflow-auto overscroll-contain" :aria-label="t('adventure.leaderboard.levelTimes')" tabindex="0">
				<table class="w-full min-w-[32rem] text-sm">
					<thead class="sticky top-0 z-10 bg-card text-muted-foreground">
						<tr><th scope="col" class="px-3 py-2 text-left">{{ t('common.level') }}</th><th scope="col" class="px-3 py-2 text-right">{{ t('adventure.leaderboard.personalBest') }}</th><th scope="col" class="px-3 py-2 text-right">{{ t('adventure.leaderboard.worldRecord') }}</th><th scope="col" class="px-3 py-2 text-right">{{ t('adventure.leaderboard.wrDelta') }}</th></tr>
					</thead>
					<tbody v-for="group in groups" :key="group.series.slug">
						<tr v-if="!series"><th colspan="4" scope="colgroup" class="border-t border-border px-3 py-2 text-left font-semibold">{{ t('adventure.series', { series: group.series.key }) }}</th></tr>
						<tr v-for="level in group.levels" :key="level.id" :data-adventure-level="level.id" class="border-t border-border/60">
							<td class="px-3 py-2"><NuxtLink :to="`/level/${level.xxHash}`" class="font-medium hover:text-primary">{{ level.name }}</NuxtLink></td>
							<td class="px-3 py-2 text-right tabular-nums"><NuxtLink v-if="level.pb" :to="`/record/${level.pb.id}`" class="hover:text-primary">{{ formatAdventureTime(level.pb.milliseconds) }}</NuxtLink><span v-else class="text-muted-foreground">{{ t('adventure.leaderboard.notCompleted') }}</span></td>
							<td class="px-3 py-2 text-right tabular-nums"><NuxtLink v-if="level.worldRecord" :to="`/record/${level.worldRecord.id}`" class="hover:text-primary">{{ formatAdventureTime(level.worldRecord.milliseconds) }}</NuxtLink><span v-else>—</span></td>
							<td class="px-3 py-2 text-right tabular-nums" :class="level.delta && level.delta > 0 ? 'text-muted-foreground' : undefined">{{ level.delta === null ? '—' : formatAdventureDelta(level.delta) }}</td>
						</tr>
					</tbody>
				</table>
			</section>
		</DataState>
		<UButton v-if="error" color="neutral" variant="soft" @click="refresh()">{{ t('adventure.leaderboard.retry') }}</UButton>
	</div>
</template>
