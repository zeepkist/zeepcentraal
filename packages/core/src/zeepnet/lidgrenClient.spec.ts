import { describe, expect, test } from 'bun:test'
import dgram from 'node:dgram'
import { BitReader, BitWriter } from './binary'
import { LidgrenClient } from './lidgrenClient'

const CONNECT = 131
const CONNECT_RESPONSE = 132
const DISCONNECT = 135

describe('LidgrenClient shutdown', () => {
	test('flushes a disconnect reason before closing its UDP socket', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		let resolveDisconnect: ((reason: string) => void) | undefined
		const disconnectReason = new Promise<string>((resolve) => {
			resolveDisconnect = resolve
		})
		server.on('message', (data, remote) => {
			if (data[0] === CONNECT) {
				server.send(connectResponse(), remote.port, remote.address)
				return
			}
			if (data[0] === DISCONNECT) {
				resolveDisconnect?.(new BitReader(data.subarray(5)).readString())
			}
		})

		const client = new LidgrenClient({
			host: '127.0.0.1',
			port,
			hail: new Uint8Array(),
			onPayload: () => {},
		})
		try {
			await withTimeout(client.connect())
			await client.close()
			expect(await withTimeout(disconnectReason)).toBe('Client shutting down')
		} finally {
			await close(server)
		}
	})

	test('settles a pending connection when closed during handshake', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		let resolveConnect: (() => void) | undefined
		const receivedConnect = new Promise<void>((resolve) => {
			resolveConnect = resolve
		})
		server.on('message', (data) => {
			if (data[0] === CONNECT) {
				resolveConnect?.()
			}
		})

		const client = new LidgrenClient({
			host: '127.0.0.1',
			port,
			hail: new Uint8Array(),
			onPayload: () => {},
		})
		try {
			const connecting = client.connect().catch((error: unknown) => error)
			await withTimeout(receivedConnect)
			await client.close()
			expect(await connecting).toEqual(new Error('Lidgren client closed'))
		} finally {
			await close(server)
		}
	})
})

function connectResponse() {
	const payload = new BitWriter()
	payload.writeString('LoadBalancer')
	payload.writeInt64(0n)
	payload.writeFloat32(0)
	return message(CONNECT_RESPONSE, payload.toUint8Array(), payload.bitLength)
}

function message(type: number, payload: Uint8Array, payloadBits: number) {
	const data = new Uint8Array(5 + payload.length)
	data[0] = type
	data[3] = payloadBits & 0xff
	data[4] = payloadBits >>> 8
	data.set(payload, 5)
	return data
}

function bind(server: ReturnType<typeof dgram.createSocket>) {
	return new Promise<number>((resolve) => {
		server.bind(0, '127.0.0.1', () => resolve(server.address().port))
	})
}

function close(server: ReturnType<typeof dgram.createSocket>) {
	return new Promise<void>((resolve) => server.close(() => resolve()))
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 1_000) {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('Test timed out')), timeoutMs)
		}),
	])
}
