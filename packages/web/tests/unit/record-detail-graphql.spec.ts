import { readFileSync } from 'node:fs'
import {
	buildSchema,
	GraphQLObjectType,
	getNamedType,
	isScalarType,
	Kind,
	parse,
	validate,
} from 'graphql'
import { describe, expect, it } from 'vitest'

const detailQuery = readFileSync(
	new URL('../../app/graphql/queries/recordDetail.graphql', import.meta.url),
	'utf8',
)
const comparisonsQuery = readFileSync(
	new URL('../../app/graphql/queries/recordComparisons.graphql', import.meta.url),
	'utf8',
)
const geometryQuery = readFileSync(
	new URL('../../app/graphql/queries/recordLevelGeometry.graphql', import.meta.url),
	'utf8',
)
const geometryComposable = readFileSync(
	new URL('../../app/composables/useRecordLevelGeometry.ts', import.meta.url),
	'utf8',
)
const comparisonsComposable = readFileSync(
	new URL('../../app/composables/useRecordComparisons.ts', import.meta.url),
	'utf8',
)
const recordPage = readFileSync(
	new URL('../../app/pages/record/[recordId].vue', import.meta.url),
	'utf8',
)
const replayWorkspace = readFileSync(
	new URL('../../app/components/record/RecordReplayWorkspace.vue', import.meta.url),
	'utf8',
)
const analysisTabs = readFileSync(
	new URL('../../app/components/record/RecordAnalysisTabs.vue', import.meta.url),
	'utf8',
)
const playbackViewer = readFileSync(
	new URL('../../app/components/record/GhostPlaybackViewer.client.vue', import.meta.url),
	'utf8',
)
const airControlAnalysis = readFileSync(
	new URL('../../app/components/record/RecordAirControlAnalysis.vue', import.meta.url),
	'utf8',
)
const driftAnalysis = readFileSync(
	new URL('../../app/components/record/RecordDriftAnalysis.vue', import.meta.url),
	'utf8',
)
const coachingInsights = readFileSync(
	new URL('../../app/components/record/RecordCoachingInsights.vue', import.meta.url),
	'utf8',
)
const schema = buildSchema(
	readFileSync(new URL('../../../graphql/schema.graphql', import.meta.url), 'utf8'),
)

describe('record detail GraphQL', () => {
	it('keeps record operations valid against current schema', () => {
		const errors = validate(
			schema,
			parse(`${detailQuery}\n${comparisonsQuery}\n${geometryQuery}`),
		)
		expect(errors.map((error) => error.message)).toEqual([])
	})

	it('loads one level geometry snapshot after hydration', () => {
		expect(geometryQuery).toContain('levelMetadata(first: 1')
		expect(geometryQuery).toContain('orderBy: [DATE_UPDATED_DESC, ID_DESC]')
		expect(geometryQuery).toContain('blocks')
		expect(geometryComposable).toContain('import.meta.server ||')
		expect(geometryComposable).toContain('!hydrated.value ||')
	})

	it('requests every stored record statistic scalar', () => {
		const statisticType = schema.getType('RecordStatistic')
		expect(statisticType).toBeInstanceOf(GraphQLObjectType)
		if (!(statisticType instanceof GraphQLObjectType)) return

		const expectedFields = Object.entries(statisticType.getFields())
			.filter(([, field]) => isScalarType(getNamedType(field.type)))
			.map(([name]) => name)
			.sort()
		const document = parse(detailQuery)
		const fragment = document.definitions.find(
			(definition) =>
				definition.kind === Kind.FRAGMENT_DEFINITION &&
				definition.name.value === 'ZC_RecordStatistic',
		)
		expect(fragment?.kind).toBe(Kind.FRAGMENT_DEFINITION)
		if (fragment?.kind !== Kind.FRAGMENT_DEFINITION) return
		const selectedFields = fragment.selectionSet.selections
			.filter((selection) => selection.kind === Kind.FIELD)
			.map((selection) => selection.name.value)
			.sort()

		expect(selectedFields).toEqual(expectedFields)
	})

	it('bounds comparison catalog, selected records, and user search', () => {
		expect(comparisonsQuery.match(/first: 10/g)).toHaveLength(3)
		expect(comparisonsQuery).toContain('first: 8')
		expect(comparisonsQuery).toContain('first: 1')
		expect(comparisonsQuery).toContain('orderBy: [TIME_ASC, ID_ASC]')
		expect(comparisonsQuery).toContain('id: { in: $recordIds }')
		expect(comparisonsQuery).toContain('levelId: { equalTo: $levelId }')
		expect(comparisonsQuery).toContain('recordMedia: { ghostUrl: { isNull: false } }')
		expect(comparisonsQuery).toContain('recordMediaExists: true')
		expect(comparisonsQuery).not.toContain('offset:')
	})

	it('keeps world record eligible in personal-best catalog', () => {
		expect(comparisonsQuery).toContain('personalBestGlobalsExist: true')
		expect(comparisonsQuery).not.toContain('worldRecordGlobalsExist: false')
	})

	it('caps variables and gates comparison requests until hydration', () => {
		expect(comparisonsComposable).toContain('MAX_RECORD_COMPARISONS = 10')
		expect(comparisonsComposable).toContain('.slice(0, MAX_RECORD_COMPARISONS)')
		expect(comparisonsComposable).toContain('RECORD_COMPARISON_USER_LIMIT = 8')
		expect(comparisonsComposable).toContain('RECORD_COMPARISON_SEARCH_MINIMUM_LENGTH = 2')
		expect(comparisonsComposable).toContain('RECORD_COMPARISON_SEARCH_DEBOUNCE_MS = 250')
		expect(comparisonsComposable).toContain('import.meta.server ||')
		expect(comparisonsComposable).toContain('!hydrated.value ||')
	})

	it('SSR-prefetches record detail and remounts when record route changes', () => {
		expect(recordPage).toContain('await recordData.prefetchCritical()')
		expect(recordPage).toContain('key: (route) => String(route.params.recordId)')
		expect(recordPage).toContain('<ClientOnly>')
		expect(recordPage).toContain('.slice(0, 10)')
	})

	it('renders comparison-aware airborne control analysis', () => {
		expect(recordPage).toContain('<RecordAirControlAnalysis')
		expect(recordPage).toContain(':runs="airControlRuns"')
		expect(recordPage).toContain('buildRecordAirControlRuns(playback.loaded.value, recordId)')
	})

	it('uses selected ghost identity colour across record analysis charts', () => {
		expect(recordPage).toContain('primaryLoadedGhost.value?.identity.bodyColor')
		expect(recordPage.match(/:primary-color="primaryVisualColor"/g)).toHaveLength(2)
		expect(recordPage).toContain('color: playback.loaded.value.find(')
		expect(recordPage).toContain(')?.identity.bodyColor')
	})

	it('keeps event timeline visible before request-free analysis tabs', () => {
		const comparisonIndex = recordPage.indexOf('id="comparison-heading"')
		const timelineIndex = recordPage.indexOf('<RecordEventTimeline')
		const tabsIndex = recordPage.indexOf('<RecordAnalysisTabs')

		expect(comparisonIndex).toBeGreaterThan(-1)
		expect(timelineIndex).toBeGreaterThan(comparisonIndex)
		expect(tabsIndex).toBeGreaterThan(timelineIndex)
		expect(recordPage).toContain('<template #telemetry>')
		expect(recordPage).toContain('<template #analysis>')
		expect(recordPage).toContain('<template #improvement>')
		expect(analysisTabs).toContain('<UTabs')
		expect(analysisTabs).toContain("ref<'telemetry' | 'analysis' | 'improvement'>('telemetry')")
		expect(analysisTabs).not.toMatch(/\$fetch|useFetch|useAsyncData|useQuery/)
	})

	it('renders analysis titles through page-level section headers', () => {
		for (const id of [
			'air-control-analysis-heading',
			'drift-analysis-heading',
			'coaching-insights-heading',
		]) {
			expect(recordPage).toContain(`aria-labelledby="${id}"`)
			expect(recordPage).toContain(`id="${id}"`)
		}
		expect(recordPage).toContain(':title="analysisLabels.airControl.title"')
		expect(recordPage).toContain(':title="analysisLabels.drift.title"')
		expect(recordPage).toContain(':title="analysisLabels.coaching.title"')
		for (const component of [airControlAnalysis, driftAnalysis, coachingInsights]) {
			expect(component).not.toContain('{{ labels.title }}')
			expect(component).not.toContain('{{ labels.description }}')
		}
	})

	it('pauses event seeks and scrolls the replay into view accessibly', () => {
		expect(recordPage).toContain('ref="replaySection"')
		expect(recordPage.match(/@seek="seekAnalysisEvent"/g)).toHaveLength(3)
		expect(recordPage).toContain('seek(time, { pause: true })')
		expect(recordPage).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
		expect(recordPage).toContain('scrollIntoView({')
		expect(replayWorkspace).toContain('if (options.pause) playing.value = false')
	})

	it('restarts completed playback and follows active ragdoll positions', () => {
		expect(replayWorkspace.match(/@update:playing="setPlaying"/g)).toHaveLength(2)
		expect(replayWorkspace).not.toContain('v-model:playing="playing"')
		expect(replayWorkspace).toContain(
			'resolveGhostPlaybackStartTime(currentTime.value, duration.value)',
		)
		expect(playbackViewer).toContain('resolveGhostDisplayPosition(frame)')
		expect(playbackViewer).toContain('visual.chassis.visible = !ragdollActive')
		expect(playbackViewer).toContain('visual.ragdoll.position.set(0, 0, 0)')
	})
})
