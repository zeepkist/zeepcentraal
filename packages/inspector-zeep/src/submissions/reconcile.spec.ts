import { expect, test } from 'bun:test'
import { reconcileSources, type SourceMessage, workshopLinks } from './reconcile'

const message = (id: string, workshop: string): SourceMessage => ({
	id,
	content: `https://steamcommunity.com/sharedfiles/filedetails/?id=${workshop}`,
	author: { id: '1' },
	timestamp: '2026-09-10T00:00:00Z',
	edited_timestamp: null,
})
test('extracts distinct numeric Workshop IDs without following arbitrary URLs', () => {
	expect(
		workshopLinks(
			'https://evil.test/?id=1 https://steamcommunity.com/workshop/filedetails/?id=123&x=1',
		),
	).toEqual([123n])
	expect(
		workshopLinks('https://steamcommunity.com/workshop/filedetails/?id=18446744073709551616'),
	).toEqual([])
	expect(
		workshopLinks('[Level](https://steamcommunity.com/sharedfiles/filedetails/?id=123)'),
	).toEqual([123n])
})
test('one submission per author, repeated references and sticky supersession', () => {
	const initial = reconcileSources([message('2', '20'), message('1', '10')], [])
	expect(initial.find((r) => r.messageId === '1')?.state).toBe('superseded')
	expect(reconcileSources([message('1', '10')], initial)[0]?.state).toBe('superseded')
	expect(
		reconcileSources([message('3', '20'), message('2', '20')], initial).filter(
			(r) => r.state === 'selected',
		),
	).toHaveLength(1)
})
test('ambiguous messages are invalid; bots ignored', () => {
	const ambiguous = message('1', '10')
	ambiguous.content += ` ${message('2', '20').content}`
	expect(
		reconcileSources([ambiguous], []).every((r) => r.sourceError === 'multiple-workshop-links'),
	).toBe(true)
	expect(reconcileSources([{ ...ambiguous, author: { id: '1', bot: true } }], [])).toEqual([])
})
