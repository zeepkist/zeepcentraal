import { expect, test } from 'bun:test'
import { createFeedGuild } from '../../test/feed-mocks'
import { sendToChannel } from './send-to-channel'

test('send to channel rejects unavailable channels and sends to text channels', async () => {
	const valid = createFeedGuild()
	expect(await sendToChannel(valid.guild, 'channel', { content: 'hi' })).toEqual({
		id: 'message-new',
	})
	expect(valid.send).toHaveBeenCalledWith({ content: 'hi' })
	for (const channel of [null, { isTextBased: () => false }, { isTextBased: () => true }]) {
		const invalid = createFeedGuild({ channel })
		await expect(sendToChannel(invalid.guild, 'channel', {})).rejects.toThrow(
			'Configured channel is unavailable',
		)
	}
})
