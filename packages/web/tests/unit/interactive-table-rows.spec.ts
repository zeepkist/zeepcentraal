import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const row = read('../../app/components/common/DataTableRow.vue')
const cellLink = read('../../app/components/common/DataTableCellLink.vue')
const standings = read('../../app/components/zsl/ZslStandingsTable.vue')
const users = read('../../app/components/user/UserLeaderboardTable.vue')
const history = read('../../app/components/record/RecordHistoryTable.vue')
const records = read('../../app/components/record/RecordTable.vue')

describe('interactive table rows', () => {
	it('shares normal, hover, viewer, and pinned presentation', () => {
		expect(row).toContain('hover:bg-primary/8')
		expect(row).toContain("viewer ? 'bg-primary/10 text-highlighted' : 'bg-card/60'")
		expect(row).toContain("pinned ? 'border-t-2 border-primary/40'")
		for (const table of [standings, users, history, records]) {
			expect(table).toContain('<DataTableRow')
			expect(table).toContain('<DataTableCellLink')
		}
	})

	it('uses native links without intercepting browser navigation', () => {
		expect(cellLink).toContain('<NuxtLink')
		expect(cellLink).toContain(':to="to"')
		expect(cellLink).toContain(':tabindex="focusable ? undefined : -1"')
		expect(cellLink).not.toContain('@click')
		expect(cellLink).not.toContain('.prevent')
	})

	it('links every standings and leaderboard cell to player profiles', () => {
		expect(standings.match(/:to="userPath\(row\.steamId\)"/g)?.length).toBeGreaterThan(4)
		expect(users.match(/:to="userPath\(user\)"/g)).toHaveLength(5)
		expect(standings).toContain('focusable')
		expect(users).toContain('focusable')
	})

	it('routes record player, level, and remaining cells independently', () => {
		for (const table of [history, records]) {
			expect(table).toContain('recordPath(record)')
			expect(table).toContain('playerOrRecordPath(record)')
		}
		expect(history).toContain('levelPath(record)')
		expect(records).toContain('levelOrRecordPath(record)')
		expect(history).not.toContain('defineEmits')
		expect(history).not.toContain('@click')
	})

	it('passes viewer identity to global users and pins only existing PB append', () => {
		const usersPage = read('../../app/pages/users.vue')
		const levelDetail = read('../../app/composables/useLevelDetail.ts')
		expect(usersPage).toContain(':viewer-user-id="session.user?.id"')
		expect(levelDetail).toContain('pinned: true')
		expect(records).toContain(':pinned="record.pinned"')
	})
})
