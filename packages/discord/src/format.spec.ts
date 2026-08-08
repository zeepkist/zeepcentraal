import { expect, test } from 'bun:test'
import { compactNumber, formatTime, playerLabel, safeMentions, truncate } from './format'

test('format exposes safe mentions', () => {
	expect(safeMentions).toEqual({ parse: [] })
})

test('player labels include valid Discord mention only', () => {
	expect(playerLabel({ steamName: 'Akane', discordId: '123456789' })).toBe('Akane (<@123456789>)')
	expect(playerLabel({ steamName: 'Akane', discordId: '-1' })).toBe('Akane')
	expect(playerLabel({ steamName: 'Akane', discordId: null })).toBe('Akane')
	expect(playerLabel({ steamName: ' ', discordId: null })).toBe('Unknown player')
	expect(playerLabel(null)).toBe('Unknown player')
})

test('race times handle missing, seconds, and minutes', () => {
	expect(formatTime(null)).toBe('N/A')
	expect(formatTime(Number.NaN)).toBe('N/A')
	expect(formatTime(12.3456)).toBe('12.346s')
	expect(formatTime(72.3456)).toBe('1:12.346')
})

test('compact numbers handle numeric inputs and invalid values', () => {
	expect(compactNumber(1234)).toBe('1.23K')
	expect(compactNumber('1000000')).toBe('1M')
	expect(compactNumber(42n)).toBe('42')
	expect(compactNumber(Number.POSITIVE_INFINITY)).toBe('∞')
	expect(compactNumber(null)).toBe('0')
})

test('truncate preserves short text and clips long text', () => {
	expect(truncate('short', 10)).toBe('short')
	expect(truncate('1234567890', 6)).toBe('12345…')
})
