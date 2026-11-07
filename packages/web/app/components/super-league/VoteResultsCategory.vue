<script setup lang="ts">
import * as Chart from 'vccs'
import type { VoteResultCategory } from '~/utils/superLeagueVoteResults'
import { voteResultChartData } from '~/utils/superLeagueVoteResults'

const props = defineProps<{
	category: VoteResultCategory
	title: string
	votedLevels: Set<number>
	ownLevels: Set<number>
}>()
const tooltipPosition = shallowRef<{ x: number; y: number } | null>(null)
function moveTooltip(event: PointerEvent) {
	tooltipPosition.value = {
		x: Math.max(16, Math.min(event.clientX + 12, window.innerWidth - 304)),
		y: Math.max(16, Math.min(event.clientY + 12, window.innerHeight - 170)),
	}
}
const { t, locale } = useAppI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const formatNumber = (value: number) => numberFormat.value.format(value)
const chartDuration = useMotionDuration(450)
const failedImages = shallowRef(new Set<number>())
function imageFailed(id: number) { failedImages.value = new Set([...failedImages.value, id]) }
const levels = computed(() => props.category.levels.map((level) => ({
	...level,
	name: `${level.name ?? level.xxHash}${level.authorNames.length ? ` ${t('tournaments.byAuthor', { author: level.authorNames.join(' + ') })}` : ''}`,
	levelName: level.name ?? level.xxHash,
	authors: level.authorIds.map((steamId, index) => ({ steamId, name: level.authorNames[index] ?? steamId })),
	imageUrl: failedImages.value.has(level.levelId) ? null : normaliseOgImageUrl(level.imageUrl),
	voted: props.votedLevels.has(level.levelId),
	own: props.ownLevels.has(level.levelId),
})))
const chartData = computed(() => voteResultChartData(props.category.levels, props.votedLevels))
const height = computed(() => Math.max(200, levels.value.length * 36 + 40))
const axisLabels = computed(() => chartData.value.map((level) => level.name.length > 26 ? `${level.name.slice(0, 25)}…` : level.name))
const yFormatter = (levelId: number) => axisLabels.value[chartData.value.findIndex((level) => level.levelId === Number(levelId))] ?? ''
const xFormatter = (value: number | Date) => Number.isInteger(Number(value)) ? formatNumber(Number(value)) : ''
const axisStyle = { fill: 'var(--ui-text)', fontFamily: 'var(--font-sans)', fontSize: 12 }
const hasVoted = computed(() => levels.value.some((level) => level.voted))
const tooltipName = (levelId: number) => levels.value.find((level) => level.levelId === levelId)?.name
</script>

<template>
	<section :aria-labelledby="`vote-category-${category.voteType}`">
		<SectionHeader :id="`vote-category-${category.voteType}`" :title="title">
			<div v-if="category.state === 'published'" class="flex items-baseline gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
				<span class="text-2xl font-bold tabular-nums text-primary" :data-category-total="category.voteType">{{ formatNumber(category.totalVotes ?? 0) }}</span>
				<span class="text-sm text-muted-foreground">{{ t('zsl.voting.totalVotes') }}</span>
			</div>
		</SectionHeader>
		<UCard class="overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm" :ui="{ body: 'p-0 sm:p-0' }">
			<div v-if="category.state === 'pending'" class="flex items-start gap-3 p-4 text-muted-foreground sm:p-6">
				<TablerIcon name="clock" class="mt-0.5 size-5 shrink-0 text-primary" />
				<div class="space-y-1">
					<p class="font-medium text-highlighted">{{ t('zsl.voting.pending') }}</p>
					<p v-if="category.deadline">{{ t('zsl.voting.availableAfter') }} <NuxtTime :datetime="category.deadline" date-style="medium" time-style="short" />.</p>
				</div>
			</div>
			<p v-else-if="category.state === 'unavailable'" class="p-4 text-muted-foreground sm:p-6">{{ t('zsl.voting.unavailable') }}</p>
			<div v-else>
				<div v-if="category.totalVotes && levels.length" class="border-b border-border p-4 sm:p-6">
					<div class="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
						<span class="flex items-center gap-2"><span class="size-2 rounded-full bg-chart-1" />{{ t('zsl.voting.votes') }}</span>
						<span v-if="hasVoted" class="flex items-center gap-2"><span class="size-2 rounded-full bg-chart-3" />{{ t('zsl.voting.youVoted') }}</span>
					</div>
					<ClientOnly>
						<div class="vote-results-chart vue-chrts max-h-128 overflow-y-auto" role="img" :aria-label="`${title}: ${t('zsl.voting.chartDescription')}`"
							@pointermove.passive="moveTooltip" @pointerdown.passive="moveTooltip" @pointerleave="tooltipPosition = null" @scroll.passive="tooltipPosition = null">
							<Chart.ResponsiveContainer width="100%" :height="height">
								<Chart.BarChart :data="chartData" layout="vertical" bar-category-gap="30%" :margin="{ top: 8, right: 16, bottom: 8, left: 0 }">
									<Chart.CartesianGrid :horizontal="false" stroke="var(--ui-border)" stroke-dasharray="3 3" />
									<Chart.XAxis type="number" :tick-formatter="xFormatter" :tick-count="5" :allow-decimals="false" :tick-text-props="axisStyle" :tick-line="false" :axis-line="false" />
									<Chart.YAxis data-key="levelId" type="category" :width="190" :tick-formatter="yFormatter" :interval="0" :tick-text-props="axisStyle" :tick-line="false" :axis-line="false" />
									<Chart.Bar data-key="votes" stack-id="votes" fill="var(--chart-1)" :radius="[0, 5, 5, 0]" :is-animation-active="chartDuration !== 0" :transition="{ duration: chartDuration / 1000, ease: 'easeOut' }" />
									<Chart.Bar data-key="votedVotes" stack-id="votes" fill="var(--chart-3)" :radius="[0, 5, 5, 0]" :is-animation-active="chartDuration !== 0" :transition="{ duration: chartDuration / 1000, ease: 'easeOut' }" />
									<!-- Custom portal escapes scrolling; hide the empty native tooltip wrapper. -->
									<Chart.Tooltip :cursor="false" :is-animation-active="false" :style="{ display: 'none' }">
										<template #content="{ payload, active }">
											<Teleport to="body">
												<div v-if="active && tooltipPosition && payload[0]?.payload" role="tooltip" class="pointer-events-none fixed z-50 max-w-72 wrap-break-word rounded-xl border border-border bg-card p-3 font-sans text-sm shadow-xl"
													:style="{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }">
													<p class="font-semibold text-highlighted">{{ tooltipName(payload[0].payload.levelId) }}</p>
													<p class="mt-1 tabular-nums text-muted-foreground">{{ formatNumber(payload[0].payload.totalVotes) }} {{ t('zsl.voting.votes') }}</p>
												</div>
											</Teleport>
										</template>
									</Chart.Tooltip>
								</Chart.BarChart>
							</Chart.ResponsiveContainer>
						</div>
						<template #fallback><USkeleton class="h-52 rounded-xl" /></template>
					</ClientOnly>
				</div>
				<p v-else class="p-4 text-sm text-muted-foreground sm:p-6">{{ levels.length ? t('zsl.voting.noVotes') : t('zsl.voting.noLevels') }}</p>
				<ol v-if="levels.length" class="divide-y divide-border" :aria-label="title">
					<li v-for="level in levels" :key="level.levelId" :data-result-level="level.levelId"
						class="px-4 py-3 transition-colors sm:px-6" :class="{ 'bg-info/10': level.voted }">
						<div class="flex items-center gap-3">
							<NuxtLink :to="`/level/${level.xxHash}`" :aria-label="level.levelName" class="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:w-24">
								<NuxtImg v-if="level.imageUrl" :src="level.imageUrl" alt="" width="192" height="108" loading="lazy"
									class="size-full object-cover" @error="imageFailed(level.levelId)" />
								<TablerIcon v-else name="photo-off" class="size-5 text-muted-foreground" />
							</NuxtLink>
							<div class="min-w-0 flex-1">
								<p class="break-words font-semibold text-highlighted">
									<NuxtLink :to="`/level/${level.xxHash}`" class="hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{{ level.levelName }}</NuxtLink>
									<template v-if="level.authors.length">{{ ' ' }}<I18nT keypath="tournaments.byAuthor" tag="span">
										<template #author>
											<template v-for="(author, index) in level.authors" :key="author.steamId">{{ index ? ' + ' : '' }}<NuxtLink :to="`/user/${author.steamId}`" class="hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{{ author.name }}</NuxtLink></template>
										</template>
									</I18nT></template>
								</p>
								<div v-if="level.voted || level.own" class="mt-1 flex flex-wrap gap-2">
									<UBadge v-if="level.voted" color="info" variant="soft" size="sm">{{ t('zsl.voting.youVoted') }}</UBadge>
									<UBadge v-if="level.own" color="primary" variant="outline" size="sm">{{ t('zsl.voting.yourLevel') }}</UBadge>
								</div>
							</div>
							<div class="shrink-0 text-right">
								<p class="text-lg font-bold tabular-nums text-highlighted">{{ formatNumber(level.votes) }}</p>
								<p class="text-xs text-muted-foreground">{{ t('zsl.voting.votes') }}</p>
							</div>
						</div>
					</li>
				</ol>
			</div>
		</UCard>
	</section>
</template>
