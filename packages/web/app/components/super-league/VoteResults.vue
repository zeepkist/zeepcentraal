<script setup vapor lang="ts">
import { useQuery } from '@urql/vue'
import { Zc_ZslRoundBySeasonAndNumberDocument } from '@zeepkist/graphql/generated'

const props = defineProps<{ seasonId: number; roundNumber: number }>()
const { t } = useI18n()
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
const { snapshot, markers, pending, error, refresh, initial } = useSuperLeagueVoteResults(roundId)
await initial
const breadcrumbItems = computed(() => [
	{ label: t('zsl.seasons'), to: '/super-league' },
	{ label: round.value?.season?.name ?? t('zsl.season'), to: superLeagueSeasonPath(props.seasonId) },
	{ label: round.value?.name ?? t('zsl.roundNumber', { round: props.roundNumber }), to: superLeagueRoundPath(props.seasonId, props.roundNumber) },
	{ label: t('zsl.voting.resultsTitle') },
])
const unavailable = computed(() => !!snapshot.value && snapshot.value.categories.every((category) => category.state === 'unavailable'))
const loadError = computed(() => result.error.value?.message ?? error.value)
const categoryNames = computed(() => [t('zsl.voting.zsl'), t('zsl.voting.decoration'), t('zsl.voting.layout')])
useSeoMeta({
	title: () => `${t('zsl.voting.resultsTitle')} · ${round.value?.name ?? t('zsl.roundNumber', { round: props.roundNumber })}`,
	description: () => t('zsl.voting.description'),
})
</script>

<template>
	<UContainer class="space-y-8 py-2">
		<ZslBreadcrumbs :label="$t('zsl.breadcrumbs')" :items="breadcrumbItems" />
		<PageHeader :eyebrow="round?.name" :title="$t('zsl.voting.resultsTitle')" :description="$t('zsl.voting.description')">
			<template #actions>
				<UButton :to="superLeagueRoundPath(seasonId, roundNumber)" variant="outline" color="neutral" icon="i-tabler-chevron-left">
					{{ $t('zsl.voting.backToRound') }}
				</UButton>
			</template>
		</PageHeader>
		<ContestLoading v-if="result.fetching.value || pending" :label="$t('common.loading')" />
		<UAlert v-else-if="loadError && !snapshot" color="error" :title="$t('common.error')" :description="loadError"
			:actions="[{ label: $t('zsl.voting.retry'), onClick: () => { result.executeQuery({ requestPolicy: 'network-only' }); refresh() } }]" />
		<UAlert v-else-if="unavailable" color="neutral" variant="soft" icon="i-tabler-chart-bar" :title="$t('zsl.voting.unavailable')" />
		<div v-else-if="snapshot" class="space-y-8">
			<VoteResultsCategory v-for="category in snapshot.categories" :key="category.voteType"
				:category="category" :title="categoryNames[category.voteType - 1] ?? ''"
				:voted-levels="markers.voted[category.voteType - 1] ?? new Set<number>()" :own-levels="markers.own" />
		</div>
		<UAlert v-if="loadError && snapshot" color="error" :title="$t('common.error')" :description="loadError"
			:actions="[{ label: $t('zsl.voting.retry'), onClick: () => refresh() }]" />
	</UContainer>
</template>
