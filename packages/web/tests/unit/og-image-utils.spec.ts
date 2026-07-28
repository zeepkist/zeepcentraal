import { describe, expect, test } from 'vitest'
import {
	formatOgCompactNumber,
	formatOgDistance,
	formatOgNumber,
	formatOgTime,
	getOgTournamentStatus,
	normaliseOgImageUrl,
	preserveOgStringProp,
	titleCaseSlug,
} from '../../app/utils/ogImage'

describe('OG image formatting', () => {
	test('formats numeric metrics consistently', () => {
		expect(formatOgNumber(1234.567)).toBe('1,234.57')
		expect(formatOgNumber(0)).toBe('0')
		expect(formatOgNumber(Number.NaN)).toBe('—')
		expect(formatOgNumber(undefined)).toBe('—')

		expect(formatOgCompactNumber(1_250_000)).toBe('1.3M')
		expect(formatOgCompactNumber(999)).toBe('999')
		expect(formatOgCompactNumber(Number.POSITIVE_INFINITY)).toBe('—')
	})

	test('formats distance in kilometres with compact large totals', () => {
		expect(formatOgDistance(1234.5)).toBe('1.23 km')
		expect(formatOgDistance(123_456_789)).toBe('123.5K km')
		expect(formatOgDistance(null)).toBe('—')
	})

	test('formats record times with milliseconds and optional hours', () => {
		expect(formatOgTime(0)).toBe('0:00.000')
		expect(formatOgTime(65.4321)).toBe('1:05.432')
		expect(formatOgTime(3661.2)).toBe('1:01:01.200')
		expect(formatOgTime(-1)).toBe('—')
		expect(formatOgTime(Number.NaN)).toBe('—')
	})

	test('turns composite route slugs into readable labels', () => {
		expect(titleCaseSlug('season-7/round_1')).toBe('Season 7 Round 1')
		expect(titleCaseSlug('/level-editor/building-tips/')).toBe('Level Editor Building Tips')
		expect(titleCaseSlug('')).toBe('')
	})
})

describe('OG string prop preservation', () => {
	test('round-trips a Steam ID through JSON without numeric coercion', () => {
		const steamId = '76561198031919228'
		const encoded = preserveOgStringProp(steamId)
		const decoded = JSON.parse(JSON.stringify({ slug: encoded })) as { slug: unknown }

		expect(typeof encoded).toBe('object')
		expect(decoded.slug).toBe(steamId)
		expect(typeof decoded.slug).toBe('string')
	})
})

describe('OG image URL normalization', () => {
	test('accepts local and approved HTTPS image sources', () => {
		expect(normaliseOgImageUrl('/images/level.png')).toBe('/images/level.png')
		expect(normaliseOgImageUrl('thumbnails/level.png')).toBe(
			'https://cdn.zeepki.st/thumbnails/level.png',
		)
		expect(normaliseOgImageUrl('assets/thumbnails/1/levels/A/A-01.avif')).toBe(
			'https://cdn.zeepki.st/assets/thumbnails/1/levels/A/A-01.avif',
		)
		expect(normaliseOgImageUrl('https://cdn.zeepki.st/thumbnails/a b.png')).toBe(
			'https://cdn.zeepki.st/thumbnails/a%20b.png',
		)
		expect(normaliseOgImageUrl('https://assets.modcdn.io/images/mod.png')).toBe(
			'https://assets.modcdn.io/images/mod.png',
		)
		expect(normaliseOgImageUrl('https://thumb.modcdn.io/mods/a/mod.png')).toBe(
			'https://thumb.modcdn.io/mods/a/mod.png',
		)
	})

	test('rejects unsafe, protocol-relative, and unapproved image sources', () => {
		for (const value of [
			'//example.com/image.png',
			'http://cdn.zeepki.st/image.png',
			'https://example.com/image.png',
			'https://other.thumb.modcdn.io/image.png',
			'data:image/png;base64,AAAA',
			'javascript:alert(1)',
			'images/relative-without-root.png',
			'not a URL',
		]) {
			expect(normaliseOgImageUrl(value), value).toBeUndefined()
		}
		expect(normaliseOgImageUrl(null)).toBeUndefined()
		expect(normaliseOgImageUrl('')).toBeUndefined()
	})
})

describe('OG tournament status', () => {
	const startAt = '2026-07-28T12:00:00.000Z'
	const endAt = '2026-07-28T13:00:00.000Z'

	test('uses inclusive start and exclusive end boundaries', () => {
		expect(getOgTournamentStatus(startAt, endAt, new Date('2026-07-28T11:59:59.999Z'))).toBe(
			'Upcoming',
		)
		expect(getOgTournamentStatus(startAt, endAt, new Date(startAt))).toBe('Live now')
		expect(getOgTournamentStatus(startAt, endAt, new Date('2026-07-28T12:30:00.000Z'))).toBe(
			'Live now',
		)
		expect(getOgTournamentStatus(startAt, endAt, new Date(endAt))).toBe('Finished')
		expect(getOgTournamentStatus(startAt, endAt, new Date('2026-07-28T13:00:00.001Z'))).toBe(
			'Finished',
		)
	})
})
