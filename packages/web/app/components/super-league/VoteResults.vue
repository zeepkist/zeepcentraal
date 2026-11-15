<script setup lang="ts">
import { useQuery } from '@urql/vue'
import { Zc_ZslRoundBySeasonAndNumberDocument } from '@zeepkist/graphql/generated'
import { superLeagueRoundPath } from '#imports'

const props = defineProps<{ seasonId: number; roundNumber: number }>()
const route = useRoute()
const router = useRouter()
const { data: contests } = useSuperLeagueContests()
const { t } = useAppI18n()
const nuxtApp = useNuxtApp()
const result = useQuery({
	query: Zc_ZslRoundBySeasonAndNumberDocument,
	variables: computed(() => ({ seasonId: props.seasonId, round: props.roundNumber })),
})
const round = computed(() => {
	const value = result.data.value?.zslRounds?.nodes[0]
	return value?.seasonId === props.seasonId && value.round === props.roundNumber ? value : null
})
if (import.meta.server) await result
watchEffect(() => {
	if (!result.fetching.value && result.data.value !== undefined && !round.value) {
		showError(createError({ statusCode: 404, statusMessage: t('zsl.notFound') }))
	}
})
const roundId = computed(() => round.value?.id)
// Results need the resolved round; preserve Nuxt context across this dependent await.
const { snapshot, markers, pending, error, refresh, initial } = await nuxtApp.runWithContext(() =>
	useSuperLeagueVoteResults(roundId),
)
const breadcrumbItems = computed(() => [
	{ label: t('zsl.seasons'), to: '/super-league' },
	{ label: round.value?.season?.name ?? t('zsl.season'), to: superLeagueSeasonPath(props.seasonId) },
	{ label: round.value?.name ?? t('zsl.roundNumber', { round: props.roundNumber }), to: superLeagueRoundPath(props.seasonId, props.roundNumber) },
	{ label: t('zsl.voting.resultsTitle') },
])
const unavailable = computed(() => !!snapshot.value && snapshot.value.categories.every((category) => category.state === 'unavailable'))
const loadError = computed(() => result.error.value?.message ?? error.value)
const categoryNames = computed(() => [t('zsl.voting.zsl'), t('zsl.voting.decoration'), t('zsl.voting.layout')])
const collapsed = shallowRef(new Set<number>())
function setOpen(voteType: number, open: boolean) {
	const next = new Set(collapsed.value)
	if (open) next.delete(voteType)
	else next.add(voteType)
	collapsed.value = next
}
watch(() => [props.seasonId, props.roundNumber], () => { collapsed.value = new Set() }, { flush: 'sync' })
const mounted = shallowRef(false)
onMounted(() => { mounted.value = true })
async function revealCategory(hash: string) {
	const match = /^#vote-category-([123])$/.exec(hash)
	if (!match || !snapshot.value || pending.value || result.fetching.value || unavailable.value) return
	setOpen(Number(match[1]), true)
	await nextTick()
	const heading = document.getElementById(hash.slice(1))
	heading?.focus({ preventScroll: true })
	heading?.scrollIntoView({ block: 'start' })
}
watch(() => [mounted.value, route.hash, snapshot.value?.roundId, pending.value, result.fetching.value], () => {
	if (mounted.value) void revealCategory(route.hash)
}, { flush: 'post' })
function jumpToCategory(voteType: number) {
	const hash = `#vote-category-${voteType}`
	if (route.hash === hash) void revealCategory(hash)
	else void router.push({ hash })
}
nuxtApp.runWithContext(() => useSeoMeta({
	title: () => `${t('zsl.voting.resultsTitle')} · ${round.value?.name ?? t('zsl.roundNumber', { round: props.roundNumber })}`,
	description: () => t('zsl.voting.description'),
}))
await initial
useDiscordComponentEmbed(() => ({
	title: `Vote results | ${round.value?.name ?? 'Super League'}`,
	description: snapshot.value?.categories.map((category) => `${categoryNames.value[category.voteType - 1]}: ${category.state}`).join(' | '),
	rows: snapshot.value?.categories.find((category) => category.voteType === 1 && category.state === 'published')?.levels.slice(0, 3).map((level) => ({ name: level.name ?? level.xxHash, url: `/level/${level.xxHash}`, value: `${level.votes} votes` })),
	links: [{ label: 'Round standings', url: superLeagueRoundPath(props.seasonId, props.roundNumber) }],
}))
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<ZslBreadcrumbs :label="t('zsl.breadcrumbs')" :items="breadcrumbItems" />
		<PageHeader :eyebrow="round?.name" :title="t('zsl.voting.resultsTitle')" :description="t('zsl.voting.description')">
			<template #actions>
				<div class="flex max-w-full flex-wrap items-center gap-3">
					<VoteResultsNavigation :contests="contests ?? []" :current-round-id="roundId" :season-id="seasonId" />
					<UButton :to="superLeagueRoundPath(seasonId, roundNumber)" variant="outline" color="neutral" size="lg" icon="i-tabler-chevron-left">
						{{ t('zsl.voting.backToRound') }}
					</UButton>
				</div>
			</template>
		</PageHeader>
		<ContestLoading v-if="result.fetching.value || pending" :label="t('common.loading')" />
		<UAlert v-else-if="loadError && !snapshot" color="error" :title="t('common.error')" :description="loadError"
			:actions="[{ label: t('zsl.voting.retry'), onClick: () => { result.executeQuery({ requestPolicy: 'network-only' }); refresh() } }]" />
		<UAlert v-else-if="unavailable" color="neutral" variant="soft" icon="i-tabler-chart-bar" :title="t('zsl.voting.unavailable')" />
		<div v-else-if="snapshot" class="space-y-8">
			<nav class="flex flex-wrap gap-2" :aria-label="t('zsl.voting.categories')">
				<UButton v-for="category in snapshot.categories" :key="category.voteType" :to="`#vote-category-${category.voteType}`"
					variant="soft" color="neutral" @click.prevent="jumpToCategory(category.voteType)">{{ categoryNames[category.voteType - 1] }}</UButton>
			</nav>
			<VoteResultsCategory v-for="category in snapshot.categories" :key="`${seasonId}-${roundNumber}-${category.voteType}`"
				:category="category" :title="categoryNames[category.voteType - 1] ?? ''"
				:open="!collapsed.has(category.voteType)" @update:open="setOpen(category.voteType, $event)"
				:voted-levels="markers.voted[category.voteType - 1] ?? new Set<number>()" :own-levels="markers.own" />
		</div>
		<UAlert v-if="loadError && snapshot" color="error" :title="t('common.error')" :description="loadError"
			:actions="[{ label: t('zsl.voting.retry'), onClick: () => refresh() }]" />
	</UContainer>
</template>
