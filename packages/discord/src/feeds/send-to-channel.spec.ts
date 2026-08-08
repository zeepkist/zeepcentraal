import { expect, test } from 'bun:test'
import { expectComponentsV2 } from '../../test/components'
import { createFeedGuild } from '../../test/feed-mocks'
import { displayContainer, messagePayload } from '../display'
import { sendToChannel } from './send-to-channel'

test('send to channel rejects unavailable channels and sends to text channels', async () => {
	const valid = createFeedGuild()
	const message = messagePayload(displayContainer({ title: 'Feed update' }))
	expect(await sendToChannel(valid.guild, 'channel', message)).toEqual({
		id: 'message-new',
	})
	expectComponentsV2((valid.send.mock.calls as unknown[][])[0]?.[0])
	for (const channel of [null, { isTextBased: () => false }, { isTextBased: () => true }]) {
		const invalid = createFeedGuild({ channel })
		await expect(sendToChannel(invalid.guild, 'channel', {})).rejects.toThrow(
			'Configured channel is unavailable',
		)
	}
})
