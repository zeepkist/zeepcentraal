<script setup vapor lang="ts">
import type { VoteResultCategory } from '~/utils/superLeagueVoteResults'
import { voteResultChartData } from '~/utils/superLeagueVoteResults'

const props = defineProps<{
	category: VoteResultCategory
	title: string
	votedLevels: Set<number>
	ownLevels: Set<number>
}>()
const { t, locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const formatNumber = (value: number) => numberFormat.value.format(value)
const reducedMotion = shallowRef(false)
let motionQuery: MediaQueryList | undefined
const updateMotion = () => { reducedMotion.value = motionQuery?.matches ?? false }
onMounted(() => {
	motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
	updateMotion()
	motionQuery.addEventListener('change', updateMotion)
})
onScopeDispose(() => motionQuery?.removeEventListener('change', updateMotion))
const failedImages = shallowRef(new Set<number>())
function imageFailed(id: number) { failedImages.value = new Set([...failedImages.value, id]) }
const levels = computed(() => props.category.levels.map((level) => ({
	...level,
	name: level.name ?? level.xxHash,
	imageUrl: failedImages.value.has(level.levelId) ? null : normaliseOgImageUrl(level.imageUrl),
	voted: props.votedLevels.has(level.levelId),
	own: props.ownLevels.has(level.levelId),
})))
// Horizontal chart index increases from bottom to top.
const chartData = computed(() => voteResultChartData([...props.category.levels].reverse(), props.votedLevels))
const chartCategories = computed(() => ({
	votes: { name: t('zsl.voting.votes'), color: 'var(--chart-1)' },
	votedVotes: { name: t('zsl.voting.youVoted'), color: 'var(--chart-3)' },
}))
const height = computed(() => Math.max(200, levels.value.length * 36 + 40))
const axisLabels = computed(() => chartData.value.map((level) => level.name.length > 26 ? `${level.name.slice(0, 25)}…` : level.name))
const yFormatter = (index: number | Date) => axisLabels.value[Number(index)] ?? ''
const xFormatter = (value: number | Date) => Number.isInteger(Number(value)) ? formatNumber(Number(value)) : ''
const yAxisConfig = computed(() => ({ tickValues: chartData.value.map((_level, index) => index) }))
const hasVoted = computed(() => levels.value.some((level) => level.voted))
function tooltipLevel(values: unknown) {
	const point = values as { datum?: { name?: string; totalVotes?: number }; name?: string; totalVotes?: number } | null
	const value = point?.datum ?? point
	return value && typeof value.totalVotes === 'number' ? value : null
}
</script>

<template>
	<section :aria-labelledby="`vote-category-${category.voteType}`">
		<SectionHeader :id="`vote-category-${category.voteType}`" :title="title">
			<div v-if="category.state === 'published'" class="flex items-baseline gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
				<span class="text-2xl font-bold tabular-nums text-primary" :data-category-total="category.voteType">{{ formatNumber(category.totalVotes ?? 0) }}</span>
				<span class="text-sm text-muted-foreground">{{ $t('zsl.voting.totalVotes') }}</span>
			</div>
		</SectionHeader>
		<UCard class="overflow-hidden rounded-2xl border-border/80 bg-card shadow-sm">
			<div v-if="category.state === 'pending'" class="flex items-start gap-3 py-4 text-muted-foreground">
				<TablerIcon name="clock" class="mt-0.5 size-5 shrink-0 text-primary" />
				<div class="space-y-1">
					<p class="font-medium text-highlighted">{{ $t('zsl.voting.pending') }}</p>
					<p v-if="category.deadline">{{ $t('zsl.voting.availableAfter') }} <NuxtTime :datetime="category.deadline" date-style="medium" time-style="short" />.</p>
				</div>
			</div>
			<p v-else-if="category.state === 'unavailable'" class="py-4 text-muted-foreground">{{ $t('zsl.voting.unavailable') }}</p>
			<div v-else class="space-y-5">
				<div v-if="category.totalVotes && levels.length" class="rounded-xl bg-primary/5 p-2 sm:p-4">
					<div class="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
						<span class="flex items-center gap-2"><span class="size-2 rounded-full bg-chart-1" />{{ $t('zsl.voting.votes') }}</span>
						<span v-if="hasVoted" class="flex items-center gap-2"><span class="size-2 rounded-full bg-chart-3" />{{ $t('zsl.voting.youVoted') }}</span>
					</div>
					<ClientOnly>
						<div class="max-h-[32rem] overflow-y-auto" role="img" :aria-label="`${title}: ${$t('zsl.voting.chartDescription')}`">
							<BarChart :data="chartData" :categories="chartCategories" :y-axis="['votes', 'votedVotes']"
								:height="height" :orientation="Orientation.Horizontal" stacked hide-legend
								:duration="reducedMotion ? 0 : 450" :radius="5" :bar-padding="0.3"
								:padding="{ top: 8, right: 16, bottom: 8, left: 4 }" :y-axis-config="yAxisConfig"
								:x-formatter="xFormatter" :y-formatter="yFormatter" :x-num-ticks="5" x-grid-line
								:tooltip="{ followCursor: true, showDelay: 80, hideDelay: 40 }">
								<template #tooltip="{ values }">
									<div v-if="tooltipLevel(values)" class="max-w-72 rounded-xl border border-border bg-card p-3 text-sm shadow-xl">
										<p class="font-semibold text-highlighted">{{ tooltipLevel(values)?.name }}</p>
										<p class="mt-1 tabular-nums text-muted-foreground">{{ formatNumber(tooltipLevel(values)?.totalVotes ?? 0) }} {{ $t('zsl.voting.votes') }}</p>
									</div>
								</template>
							</BarChart>
						</div>
						<template #fallback><USkeleton class="h-52 rounded-xl" /></template>
					</ClientOnly>
				</div>
				<p v-else class="text-sm text-muted-foreground">{{ levels.length ? $t('zsl.voting.noVotes') : $t('zsl.voting.noLevels') }}</p>
				<ol v-if="levels.length" class="divide-y divide-border" :aria-label="title">
					<li v-for="level in levels" :key="level.levelId" :data-result-level="level.levelId"
						class="rounded-lg px-2 py-3 transition-colors" :class="{ 'bg-info/10': level.voted }">
						<NuxtLink :to="`/level/${level.xxHash}`" class="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
							<div class="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:w-24">
								<NuxtImg v-if="level.imageUrl" :src="level.imageUrl" alt="" width="192" height="108" loading="lazy"
									class="size-full object-cover" @error="imageFailed(level.levelId)" />
								<TablerIcon v-else name="photo-off" class="size-5 text-muted-foreground" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="break-words font-semibold text-highlighted">{{ level.name }}</p>
								<div v-if="level.voted || level.own" class="mt-1 flex flex-wrap gap-2">
									<UBadge v-if="level.voted" color="info" variant="soft" size="sm">{{ $t('zsl.voting.youVoted') }}</UBadge>
									<UBadge v-if="level.own" color="primary" variant="outline" size="sm">{{ $t('zsl.voting.yourLevel') }}</UBadge>
								</div>
							</div>
							<div class="shrink-0 text-right">
								<p class="text-lg font-bold tabular-nums text-highlighted">{{ formatNumber(level.votes) }}</p>
								<p class="text-xs text-muted-foreground">{{ $t('zsl.voting.votes') }}</p>
							</div>
						</NuxtLink>
					</li>
				</ol>
			</div>
		</UCard>
	</section>
</template>
