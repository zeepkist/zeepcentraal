import { expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { BunSqlSubscriber } from './bunSqlSubscriber'

test('delivers notifications and closes waiting iterators on release', async () => {
	let notify: (payload: string) => void = () => {}
	let unlistened = 0
	const client = {
		listen: async (_topic: string, receive: typeof notify) => {
			notify = receive
			return {
				unlisten: async () => {
					unlistened++
				},
			}
		},
	} as unknown as SQL
	const subscriber = new BunSqlSubscriber(client)
	const iterator = subscriber.subscribe('topic')
	notify('first')
	expect(await iterator.next()).toEqual({ done: false, value: 'first' })
	const pending = iterator.next()
	await subscriber.release()
	expect(await pending).toEqual({ done: true, value: undefined })
	expect(unlistened).toBe(1)
	await subscriber.release()
	expect(unlistened).toBe(1)
	expect(() => subscriber.subscribe('topic')).toThrow('released')
})

test('initial LISTEN failure rejects iterator instead of hanging', async () => {
	const client = {
		listen: async () => {
			throw new Error('listen failed')
		},
	} as unknown as SQL
	const subscriber = new BunSqlSubscriber(client)
	const iterator = subscriber.subscribe('topic')
	await expect(iterator.next()).rejects.toThrow('listen failed')
	await subscriber.release()
})
