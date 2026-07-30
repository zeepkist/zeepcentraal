<template>
	<UContainer class="py-2">
		<DataState
			:pending="recordData.detail.fetching.value"
			:error="recordData.detail.error.value?.message"
			:empty="!recordData.detail.fetching.value && !record"
			:loading-label="$t('common.loading')"
			:error-title="$t('common.error')"
			:empty-title="$t('pages.recordDetail.notFound')"
		>
			<template #pending>
				<SharedDetailPreview
					v-if="transitionPreview"
					entity="record"
					:entity-id="recordId"
					:preview="transitionPreview"
				/>
				<div v-else class="space-y-3">
					<USkeleton v-for="index in 4" :key="index" class="h-24 rounded-xl" />
				</div>
			</template>
			<div v-if="record && source && record.level" class="space-y-8 lg:space-y-10">
				<RecordDetailHero
					:record="source"
					:level-hash="record.level.xxHash"
					:level-name="levelName"
					:image-url="publicLevelItem?.imageUrl"
					:game-version="record.gameVersion"
					:mod-version="record.modVersion"
					:ghost-version="record.recordStatistic?.ghostVersion"
					:level-rank="contribution?.levelPosition"
					:ranked-points="contribution?.playerDecayedPoints"
					:labels="heroLabels"
				/>

				<div ref="ghostExperienceTarget">
					<LazyRecordGhostExperience
						v-if="ghostExperienceActive"
						:record-id="recordId"
					/>
					<section
						v-else
						class="scroll-mt-20 lg:scroll-mt-24"
						aria-labelledby="replay-heading"
					>
						<SectionHeader
							id="replay-heading"
							:title="$t('pages.recordDetail.replay.title')"
							:description="$t('pages.recordDetail.replay.description')"
						/>
						<div
							class="grid aspect-video min-h-80 place-items-center rounded-2xl border border-border bg-card/60"
							role="status"
							:aria-label="$t('common.loading')"
						>
							<USkeleton class="size-full rounded-2xl" />
						</div>
					</section>
				</div>
			</div>
		</DataState>
	</UContainer>
</template>

<script setup vapor lang="ts">
import { getLevelDisplayName } from '~/utils/levelDisplay'

definePageMeta({ key: (route) => String(route.params.recordId) })

const route = useRoute()
const { t } = useI18n()
const rawRecordId = route.params.recordId
const parsedRecordId =
	typeof rawRecordId === 'string' && /^\d+$/.test(rawRecordId) ? Number(rawRecordId) : null
if (parsedRecordId === null || !Number.isSafeInteger(parsedRecordId) || parsedRecordId < 1) {
	throw createError({ statusCode: 404, statusMessage: t('pages.recordDetail.notFound') })
}
const recordId = parsedRecordId
defineOgImage('RecordDetail.takumi', { slug: String(recordId) })
const recordData = useRecordDetail(computed(() => recordId))
await recordData.prefetchCritical()
const transition = useSharedViewTransition()
const transitionPreview = computed(() => transition.preview('record', recordId))
const record = recordData.record
const source = recordData.source
const levelItem = recordData.levelItem
if (import.meta.server && !record.value && !recordData.detail.error.value) {
	throw createError({ statusCode: 404, statusMessage: t('pages.recordDetail.notFound') })
}

const contribution = computed(() => record.value?.userPointContributions.nodes[0] ?? null)
const publicLevelItem = computed(() =>
	record.value?.level?.publiclyVisible ? levelItem.value : null,
)
const levelName = computed(() =>
	getLevelDisplayName(publicLevelItem.value?.name, record.value?.level?.xxHash ?? ''),
)
const ghostExperienceActive = ref(false)
const ghostExperienceTarget = useTemplateRef('ghostExperienceTarget')
let ghostExperienceObserver: IntersectionObserver | undefined

onMounted(() => {
	if (ghostExperienceActive.value) return
	const target = ghostExperienceTarget.value
	if (!target || typeof IntersectionObserver === 'undefined') {
		ghostExperienceActive.value = true
		return
	}
	ghostExperienceObserver = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return
			ghostExperienceActive.value = true
			ghostExperienceObserver?.disconnect()
			ghostExperienceObserver = undefined
		},
		{ rootMargin: '25% 0px' },
	)
	ghostExperienceObserver.observe(target)
})

onScopeDispose(() => ghostExperienceObserver?.disconnect())

useSeoMeta({
	robots: () =>
		record.value?.level?.publiclyVisible === false ? 'noindex, nofollow' : 'index, follow',
	title: () =>
		t('pages.recordDetail.seo.title', {
			id: recordId,
			player: record.value?.user?.steamName ?? t('common.unknownPlayer'),
			level: levelName.value,
		}),
	description: () => {
		const value = record.value
		return value
			? t('pages.recordDetail.seo.recordDescription', {
					player: value.user?.steamName ?? t('common.unknownPlayer'),
					level: levelName.value,
				})
			: t('pages.recordDetail.seo.description')
	},
})
useSchemaOrg([defineWebPage({ name: () => t('pages.recordDetail.seo.title', { id: recordId }) })])

const heroLabels = computed(() => ({
	worldRecord: t('common.worldRecord'),
	personalBest: t('common.personalBest'),
	record: (id: number) => t('pages.recordDetail.hero.record', { id }),
	recordTime: t('pages.recordDetail.hero.recordTime'),
	unknownPlayer: t('common.unknownPlayer'),
	set: t('common.set'),
	gameVersion: t('common.gameVersion'),
	modVersion: t('common.modVersion'),
	ghostVersion: t('common.ghostVersion'),
	levelRank: t('common.levelRank'),
	rankedPoints: t('common.rankedPoints'),
	unavailable: t('common.unavailable'),
}))
</script>
