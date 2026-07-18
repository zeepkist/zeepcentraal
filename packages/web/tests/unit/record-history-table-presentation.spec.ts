import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getRecordHistoryColumns } from '../../app/utils/recordHistoryColumns'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('record history table presentation', () => {
	it('preserves global record column order by default', () => {
		expect(getRecordHistoryColumns({ showPlayer: true, showStatus: true })).toEqual([
			'level',
			'player',
			'rank',
			'time',
			'status',
			'points',
			'rankedPoints',
			'date',
		])
	})

	it('places rank before configured level or player columns', () => {
		expect(getRecordHistoryColumns({ rankFirst: true })).toEqual([
			'rank',
			'level',
			'time',
			'points',
			'rankedPoints',
			'date',
		])
		expect(
			getRecordHistoryColumns({ showLevel: false, showPlayer: true, rankFirst: true }),
		).toEqual(['rank', 'player', 'time', 'points', 'rankedPoints', 'date'])
	})

	it('supports status modes, pinned rows, and data-fed point help', () => {
		const table = read('../../app/components/record/RecordHistoryTable.vue')
		const header = read('../../app/components/record/RecordPointsHeader.vue')
		expect(table).toContain("statusMode?: 'none' | 'world-record-only' | 'all'")
		expect(table).toContain(':pinned="record.pinned"')
		expect(table).toContain(':help="labels.pointsHelp"')
		expect(table).toContain(':help="labels.rankedPointsHelp"')
		expect(header).toContain('<UTooltip')
		expect(header).toContain('<button')
		expect(header).toContain('focus-visible:ring-2')
		expect(header).not.toContain('useQuery')
		expect(header).not.toContain('$fetch')
	})
})
