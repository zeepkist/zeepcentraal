import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const query = readFileSync(
	new URL('../../../graphql/documents/web/queries/levelDetail.graphql', import.meta.url),
	'utf8',
)
const page = readFileSync(
	new URL('../../app/pages/level/[xxh128].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')
const component = readFileSync(
	new URL('../../app/components/level/LevelScoreBreakdown.vue', import.meta.url),
	'utf8',
)
const locale = readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8')

const scoreFields = [
	'modifierLength',
	'modifierEvidence',
	'modifierQuality',
	'modifierRating',
	'complexityConfidence',
	'complexityScore',
	'fieldStrength',
	'qualityScore',
	'skillAlignment',
	'skillConfidence',
	'skillSampleSize',
	'skillScore',
	'skillSeparation',
] as const

describe('level score breakdown', () => {
	it('requests exact retained score and selectivity signals', () => {
		for (const field of scoreFields) expect(query).toMatch(new RegExp(`\\n\\s+${field}\\n`))
		expect(query).not.toContain('modifierCompetitiveness')
		for (const field of [
			'modifierPopularity',
			'sampleSize',
			'passivePlaySeverity',
			'scoreVersion',
		]) {
			expect(query).not.toContain(field)
		}
	})

	it('renders through a request-free data-fed component', () => {
		expect(page).toContain('<LevelScoreBreakdown')
		expect(page).toContain(':model="levelData.scoreInsights.value"')
		expect(page).toContain(':points="summary.points"')
		expect(component).toContain('model: LevelScoreInsights')
		expect(component).toContain('points?: number | null')
		expect(component).not.toMatch(/useQuery|useFetch|\$fetch/)
	})

	it('shows the active V2 multiplication path in formula order', () => {
		expect(component).toContain("import { MAX_LEVEL_POINTS } from '@zeepkist/core/score'")
		expect(component).toContain('integerFormat.format(MAX_LEVEL_POINTS)')
		expect(component).toContain('factorStages')
		expect(component).toMatch(
			/stage\.key === 'quality'[\s\S]*stage\.key === 'evidence'[\s\S]*stage\.key === 'length'[\s\S]*stage\.key === 'votes'/,
		)
		expect(locale).toContain(
			'"summary": "{base} base points multiplied by quality {quality}, evidence {evidence}, length {length}, and votes {votes}, resulting in {result} level points."',
		)
	})

	it('feeds complexity and skill into quality without legacy diagnostics', () => {
		expect(component).toContain('M100 92 C100 196 300 190 300 310')
		expect(component).toContain('M300 92 L300 310')
		expect(component).not.toContain('diagnostic-lane')
		expect(component).not.toContain('competitiveMerit')
		expect(component).not.toContain('worldRecordExcluded')
	})

	it('supports persistent progressive detail and one-time motion preferences', () => {
		expect(component).toContain("const activeStage = ref<StageKey>('quality')")
		expect(component).toContain('@click="selectStage(')
		expect(component).toContain('@focus="selectStage(')
		expect(component).toContain('@pointerenter="hoveredStage =')
		expect(component).toContain(':aria-pressed="activeStage ===')
		expect(component).toContain(':aria-controls="inspectorId"')
		expect(component).toContain('aria-live="polite"')
		expect(component).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
		expect(component).toContain('@media (prefers-reduced-motion: reduce)')
		expect(component).toContain('IntersectionObserver')
		expect(component).not.toContain('reactor-pulse')
		expect(component).not.toContain('reactor-flow')
	})

	it('centres factor operators in a responsive flex rail', () => {
		expect(component).toContain('<div class="reactor-factor-rail">')
		expect(component).toContain('<span class="reactor-operator" aria-hidden="true">×</span>')
		expect(component).toContain('<span class="reactor-equals" aria-hidden="true">=</span>')
		expect(component).toContain('flex-direction: column')
		expect(component).toMatch(
			/\.reactor-factor-rail \{[\s\S]*flex-direction: row;[\s\S]*align-items: center;/,
		)
		expect(component).toMatch(
			/\.reactor-operator,[\s\S]*\.reactor-equals \{[\s\S]*display: flex;[\s\S]*flex: none;/,
		)
		const operatorStyles = component.slice(
			component.indexOf('.reactor-operator,'),
			component.indexOf('.reactor-output-core'),
		)
		expect(operatorStyles).not.toContain('position: absolute')
	})

	it('uses gauges, static reactor flow, final points core, and shared vote donut', () => {
		expect(component).toContain('class="gauge-score"')
		expect(component).toContain('class="gauge-confidence"')
		expect(component).toContain('class="reactor-path"')
		expect(component).toContain('class="reactor-output-core"')
		expect(component).toContain('<VoteDistributionChart')
		expect(component).not.toContain('v-for="group in groups"')
		expect(component).not.toContain('rounded-xl border border-border/60 bg-default/45')
	})

	it('uses requested missing-value language', () => {
		expect(locale).toContain('"unavailable": "-"')
		expect(locale).toContain('"notAvailable": "N/A"')
		expect(component).toContain(': props.labels.unavailable')
		expect(component).toContain('v-else class="font-medium text-muted-foreground"')
		expect(`${component}\n${page}\n${locale}`).not.toContain('Insufficient telemetry')
	})
})
