import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveRecordPbOrWr } from '../../app/utils/levelRecordRows'

const resultsQuery = readFileSync(
	new URL('../../app/graphql/queries/userResults.graphql', import.meta.url),
	'utf8',
)
const contributionsQuery = readFileSync(
	new URL('../../app/graphql/queries/userContributions.graphql', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useUserProfile.ts', import.meta.url),
	'utf8',
)
const section = readFileSync(
	new URL('../../app/components/user/UserResultsSection.vue', import.meta.url),
	'utf8',
)
const table = readFileSync(
	new URL('../../app/components/record/RecordTable.vue', import.meta.url),
	'utf8',
)
const page = readFileSync(new URL('../../app/pages/user/[steamid].vue', import.meta.url), 'utf8')

describe('user profile record results', () => {
	it('keeps personal best filters inclusive of world records', () => {
		expect(composable).toContain('personalBestGlobalsExist: true')
		expect(composable).not.toContain('worldRecordGlobalsExist: false')
		expect(composable).not.toContain('levelPosition: { greaterThan: 1 }')
		expect(composable).toContain("node.levelPosition === 1 ? 'world-record' : 'personal-best'")
	})

	it('uses deterministic valuable and recent ordering', () => {
		expect(contributionsQuery).toContain('orderBy: [PLAYER_DECAYED_POINTS_DESC, LEVEL_ID_ASC]')
		expect(resultsQuery).toContain('orderBy: [DATE_CREATED_DESC, ID_DESC]')
		expect(composable).toContain('useCursorPagination(25,')
	})

	it('loads current PB and WR relations with WR precedence', () => {
		expect(resultsQuery).toContain('personalBestGlobals(first: 0)')
		expect(resultsQuery).toContain('worldRecordGlobals(first: 0)')
		expect(
			resolveRecordPbOrWr({
				personalBestGlobals: { totalCount: 1 },
				worldRecordGlobals: { totalCount: 1 },
			}),
		).toBe('world-record')
		expect(
			resolveRecordPbOrWr({
				personalBestGlobals: { totalCount: 1 },
				worldRecordGlobals: { totalCount: 0 },
			}),
		).toBe('personal-best')
		expect(
			resolveRecordPbOrWr({
				personalBestGlobals: { totalCount: 0 },
				worldRecordGlobals: { totalCount: 0 },
			}),
		).toBeNull()
	})

	it('reuses RecordTable without player column and exposes shared status styles', () => {
		expect(section).toContain('<RecordTable')
		expect(section).toContain(':show-user="false"')
		expect(table).toContain('v-if="showUser"')
		expect(table).toContain("record.pbOrWr === 'world-record'")
		expect(table).toContain("record.pbOrWr === 'personal-best'")
		expect(table).toContain('bg-purple-500/15')
	})

	it('aligns selectors and renders PB/recent results full-width', () => {
		expect(section).toContain('<SectionHeader')
		expect(section).toContain('i-tabler-arrows-sort')
		expect(section).toContain('class="w-48"')
		expect(page).not.toContain('xl:grid-cols-2 xl:items-start')
		expect(page).toContain('<div class="space-y-8 lg:space-y-10">')
		expect(page).toContain('id="profile-personal-bests"')
		expect(page).toContain('id="profile-recent"')
		expect(page).toContain('show-pb-or-wr')
	})

	it('retains resolved rows while replacement queries fetch', () => {
		expect(composable).toContain('function retainRows(')
		expect(composable).toContain('if (ready) retained.value = nextRows')
		expect(section).toContain(':pending="pending && records.length === 0"')
		expect(section).toContain(':pending="pending"')
	})
})
