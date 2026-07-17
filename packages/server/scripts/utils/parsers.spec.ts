import { describe, expect, test } from 'bun:test'
import {
	InputValidationError,
	parseBoundedPositiveSafeInteger,
	parseNonnegativeSafeInteger,
	parsePositiveSafeInteger,
	parsePositiveSafeIntegerList,
	parseWorkshopId,
	parseWorkshopIdList,
} from './parsers'

describe('positive integer parsing', () => {
	test('accepts positive safe integers and zero only where allowed', () => {
		expect(parsePositiveSafeInteger('42')).toBe(42)
		expect(parseNonnegativeSafeInteger('0')).toBe(0)
		expect(parseBoundedPositiveSafeInteger('500', 500)).toBe(500)
	})

	test('rejects invalid, unsafe, and out-of-range values', () => {
		expect(() => parsePositiveSafeInteger('0')).toThrow(InputValidationError)
		expect(() => parsePositiveSafeInteger('-1')).toThrow(InputValidationError)
		expect(() => parsePositiveSafeInteger('1.5')).toThrow(InputValidationError)
		expect(() => parsePositiveSafeInteger('9007199254740992')).toThrow('safe integer')
		expect(() => parseBoundedPositiveSafeInteger('501', 500)).toThrow('at most 500')
	})

	test('parses comma, whitespace, and newline-separated lists with stable deduplication', () => {
		expect(parsePositiveSafeIntegerList('3, 1\n2\t3 1')).toEqual([3, 1, 2])
	})

	test('enforces list presence and maximum after deduplication', () => {
		expect(() => parsePositiveSafeIntegerList('  , \n')).toThrow('at least one')
		expect(() => parsePositiveSafeIntegerList('1 2 3', { maximum: 2 })).toThrow('at most 2')
		expect(parsePositiveSafeIntegerList('1 1 2', { maximum: 2 })).toEqual([1, 2])
	})
})

describe('Workshop ID parsing', () => {
	test('preserves decimal strings larger than JavaScript safe integers', () => {
		const workshopId = '18446744073709551615'
		expect(parseWorkshopId(workshopId)).toBe(workshopId)
	})

	test('deduplicates mixed-delimiter Workshop ID lists', () => {
		expect(parseWorkshopIdList('3006532933,3749321871\n3006532933')).toEqual([
			'3006532933',
			'3749321871',
		])
	})

	test('rejects non-positive or non-decimal Workshop IDs and oversized batches', () => {
		expect(() => parseWorkshopId('0')).toThrow(InputValidationError)
		expect(() => parseWorkshopId('123abc')).toThrow(InputValidationError)
		expect(() => parseWorkshopIdList('1 2 3', { maximum: 2 })).toThrow('at most 2')
	})
})
