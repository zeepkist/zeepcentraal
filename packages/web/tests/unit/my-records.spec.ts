import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDecayPercentageFormatter } from '../../app/utils/decayPercentage'
import { normalizeMyRecordView } from '../../app/utils/myRecords'

describe('personal record views', () => {
	it('accepts supported views', () => {
		expect(normalizeMyRecordView('recent')).toBe('recent')
		expect(normalizeMyRecordView('personal-bests')).toBe('personal-bests')
		expect(normalizeMyRecordView('world-records')).toBe('world-records')
	})

	it('falls back to recent for invalid query values', () => {
		expect(normalizeMyRecordView(undefined)).toBe('recent')
		expect(normalizeMyRecordView('fastest')).toBe('recent')
		expect(normalizeMyRecordView(['world-records'])).toBe('recent')
	})

	it('uses exact cursor page size and mutually exclusive PB filters', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useMyRecords.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain("useCursorPagination(25, 'myRecords')")
		expect(composable).toContain('personalBestGlobalsExist: true')
		expect(composable).toContain('worldRecordGlobalsExist: false')
		expect(composable).toContain('worldRecordGlobalsExist: true')
	})

	it('requests contribution rank with bounded cursor pagination', () => {
		const query = readFileSync(
			new URL('../../app/graphql/queries/myRecords.graphql', import.meta.url),
			'utf8',
		)
		expect(query).toContain('$first: Int')
		expect(query).toContain('$after: Cursor')
		expect(query).toContain('orderBy: [DATE_CREATED_DESC]')
		expect(query).toContain('contributionRank')
		expect(query).toContain('levelPoints')
	})

	it('maps level and global points with their independent decay inputs', () => {
		const composable = readFileSync(
			new URL('../../app/composables/useMyRecords.ts', import.meta.url),
			'utf8',
		)
		expect(composable).toContain('levelPoints: contribution?.levelPoints')
		expect(composable).toContain('levelDecayedPoints: contribution?.levelDecayedPoints')
		expect(composable).toContain('playerDecayedPoints: contribution?.playerDecayedPoints')
		expect(composable).toContain(
			'calculateDecayMultiplier(contribution.levelPosition, LEVEL_DECAY_FACTOR)',
		)
		expect(composable).toContain('contribution.contributionRank,')
		expect(composable).toContain('GLOBAL_DECAY_FACTOR,')
		expect(composable).toContain(': undefined')
	})

	it('formats localized decay percentages with at most one decimal', () => {
		expect(createDecayPercentageFormatter('en-GB').format(0.985)).toBe('98.5%')
		expect(createDecayPercentageFormatter('en-GB').format(0.95 ** 2)).toBe('90.3%')
		expect(createDecayPercentageFormatter('en-GB', 3, 3).format(0.985)).toBe('98.500%')
	})

	it('uses seven fixed columns while leaving level width flexible', () => {
		const component = readFileSync(
			new URL('../../app/components/record/MyRecordTable.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('table-fixed')
		expect(component).toContain('min-w-[64rem]')
		expect(component.match(/<col(?:\s|\/)/g)).toHaveLength(7)
		expect(component).toContain('<col />')
		expect(component).toContain('w-[6rem]')
		expect(component).toContain('w-[7rem]')
		expect(component.match(/w-\[8rem\]/g)).toHaveLength(3)
		expect(component).toContain('w-[9rem]')
		expect(component).toContain('block truncate font-bold')
	})

	it('renders separate point values and subdued decay percentages', () => {
		const component = readFileSync(
			new URL('../../app/components/record/MyRecordTable.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('labels.rankedPoints')
		expect(component).toContain('record.levelDecayedPoints')
		expect(component).toContain('record.playerDecayedPoints')
		expect(component).toContain('record.levelDecayMultiplier')
		expect(component).toContain('record.globalDecayMultiplier')
		expect(component).not.toContain('nonDecayed')
	})

	it('shows raw level points and precise decay tooltips', () => {
		const table = readFileSync(
			new URL('../../app/components/record/MyRecordTable.vue', import.meta.url),
			'utf8',
		)
		const pointValue = readFileSync(
			new URL('../../app/components/record/RecordPointValue.vue', import.meta.url),
			'utf8',
		)
		expect(table).toContain('labels.levelPoints')
		expect(table).toContain('record.levelPoints')
		expect(pointValue).toContain('<UTooltip')
		expect(pointValue).toContain('text-xs text-muted-foreground/70')
		expect(pointValue).toContain('createDecayPercentageFormatter(locale.value, 3, 3)')
	})

	it('keeps row and level-link navigation independent', () => {
		const component = readFileSync(
			new URL('../../app/components/record/MyRecordTable.vue', import.meta.url),
			'utf8',
		)
		expect(component).toContain('@click="$emit(\'select\', record.id)"')
		expect(component).toContain('@keydown.enter.prevent')
		expect(component).toContain('@keydown.space.prevent')
		expect(component).toContain('@click.stop')
	})
})
