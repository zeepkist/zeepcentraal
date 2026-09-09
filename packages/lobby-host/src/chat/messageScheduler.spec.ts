import { expect, mock, test } from 'bun:test'
import { MessageScheduler } from './messageScheduler'

test('coalesces requests, schedules refresh and cancels on scope close', async () => {
	const send = mock(async () => {})
	const scheduler = new MessageScheduler(send, () => {})
	scheduler.request(5)
	scheduler.request(5)
	await Bun.sleep(20)
	expect(send).toHaveBeenCalledTimes(1)
	scheduler.refresh(5)
	await Bun.sleep(20)
	expect(send).toHaveBeenCalledTimes(2)
	scheduler.request(5)
	scheduler.refresh(5)
	scheduler.close()
	await Bun.sleep(20)
	expect(send).toHaveBeenCalledTimes(2)
})
test('delivery failure reaches policy handler and does not poison later sends', async () => {
	let fail = true
	const error = mock(() => {})
	const send = mock(async () => {
		if (fail) throw new Error('failed')
	})
	const scheduler = new MessageScheduler(send, error)
	scheduler.request(0)
	await Bun.sleep(10)
	expect(error).toHaveBeenCalledTimes(1)
	fail = false
	scheduler.request(0)
	await Bun.sleep(10)
	expect(send).toHaveBeenCalledTimes(2)
	scheduler.close()
})
