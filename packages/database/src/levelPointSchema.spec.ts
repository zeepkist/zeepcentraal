import { describe, expect, test } from 'bun:test'
import { getTableColumns } from 'drizzle-orm'
import { levelPoints, levelPointsHistory } from './schema'

const retainedColumns = [
	'complexityConfidence',
	'complexityScore',
	'dateCreated',
	'dateUpdated',
	'evidenceModifier',
	'fieldStrength',
	'idLevel',
	'lengthModifier',
	'points',
	'qualityModifier',
	'qualityScore',
	'rating',
	'ratingModifier',
	'skillAlignment',
	'skillConfidence',
	'skillSampleSize',
	'skillScore',
	'skillSeparation',
]

describe('level point persistence schema', () => {
	test('current table contains exact retained V2 fields', () => {
		expect(Object.keys(getTableColumns(levelPoints)).toSorted()).toEqual(retainedColumns)
	})

	test('history table adds only history identity', () => {
		expect(Object.keys(getTableColumns(levelPointsHistory)).toSorted()).toEqual(
			[...retainedColumns, 'id'].toSorted(),
		)
	})
})
