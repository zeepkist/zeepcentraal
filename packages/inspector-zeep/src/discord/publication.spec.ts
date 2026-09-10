import { beforeEach, expect, mock, test } from 'bun:test'
import type { ContestRow } from '@zeepkist/database/services/level-submissions'
import type { SourceMessage } from '../submissions/reconcile'
import type { DiscordRest } from './client'

let saved: ContestRow['publication'][] = []
mock.module('@zeepkist/database/services/level-submissions', () => ({
	saveSubmissionPublication: async (_id: bigint, value: ContestRow['publication']) => {
		saved.push(structuredClone(value))
	},
}))
const { publishDiscordPlaylist } = await import('./publication')
const version = { digest: 'revision', validCount: 1, dateCreated: '2026-09-10T00:00:00Z' }
const contest = (publication: ContestRow['publication'] = {}) =>
	({ id: 1n, threadId: '3', publication }) as ContestRow
const message = (id: string, author: string, filename?: string) =>
	({
		id,
		author: { id: author, bot: true },
		attachments: filename ? [{ filename }] : [],
	}) as SourceMessage
beforeEach(() => {
	saved = []
})

test('unchanged published digest sends nothing', async () => {
	const request = mock(async () => ({ id: 'new' }))
	await publishDiscordPlaylist(
		{ request } as unknown as DiscordRest,
		'bot',
		contest({ digest: 'revision', messageId: 'old' }),
		version,
		'{}',
		[],
	)
	expect(request).not.toHaveBeenCalled()
	expect(saved).toHaveLength(0)
})
test('recovers successful send after crash without posting duplicate; deletes only own old message', async () => {
	const request = mock(async (_path: string, _method: string) => ({ id: 'unused' }))
	await publishDiscordPlaylist(
		{ request } as unknown as DiscordRest,
		'bot',
		contest({ digest: 'previous', messageId: 'old', cleanupIds: ['unrelated'] }),
		version,
		'{}',
		[
			message('recovered', 'bot', 'contest-3-revision.zeeplist'),
			message('old', 'bot'),
			message('unrelated', 'someone-else'),
		],
	)
	expect(request.mock.calls).toEqual([['/channels/3/messages/old', 'DELETE']])
	expect(saved[0]?.messageId).toBe('recovered')
	expect(saved.at(-1)?.cleanupIds).toEqual([])
})
test('replacement persists before deleting old post; deletion failure remains retryable', async () => {
	const request = mock(async (_path: string, method: string) => {
		if (method === 'DELETE') {
			expect(saved[0]?.messageId).toBe('new')
			throw new Error('transient')
		}
		return { id: 'new' }
	})
	await expect(
		publishDiscordPlaylist(
			{ request } as unknown as DiscordRest,
			'bot',
			contest({ digest: 'previous', messageId: 'old' }),
			version,
			'{}',
			[message('old', 'bot')],
		),
	).rejects.toThrow('transient')
	expect(saved[0]?.cleanupIds).toEqual(['old'])
})
