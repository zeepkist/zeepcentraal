import { describe, expect, test } from 'bun:test'
import dgram from 'node:dgram'
import { BitReader, BitWriter } from './binary'
import { LidgrenClient } from './lidgrenClient'

const CONNECT = 131
const CONNECT_RESPONSE = 132
const CONNECTION_ESTABLISHED = 133
const ACKNOWLEDGE = 134
const DISCONNECT = 135
const RELIABLE_ORDERED = 67

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

describe('LidgrenClient protocol', () => {
	test('uses configured application identifier and exposes remote hail', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		const receivedHail = new Promise<Uint8Array>((resolve) => {
			server.on('message', (data, remote) => {
				if (data[0] !== CONNECT) return
				const reader = new BitReader(data.subarray(5))
				expect(reader.readString()).toBe('GameServer')
				server.send(
					connectResponse('GameServer', Uint8Array.of(4, 5, 6)),
					remote.port,
					remote.address,
				)
			})
			const client = new LidgrenClient({
				applicationIdentifier: 'GameServer',
				host: '127.0.0.1',
				port,
				hail: Uint8Array.of(1, 2, 3),
				onConnected: resolve,
				onPayload: () => {},
			})
			void client.connect().then(() => client.close())
		})
		try {
			expect([...(await withTimeout(receivedHail))]).toEqual([4, 5, 6])
		} finally {
			await close(server)
		}
	})

	test('retries unacknowledged reliable messages and settles on ACK', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		let attempts = 0
		server.on('message', (data, remote) => {
			if (data[0] === CONNECT) {
				server.send(connectResponse(), remote.port, remote.address)
				return
			}
			if (data[0] !== RELIABLE_ORDERED) return
			attempts++
			if (attempts === 2) server.send(acknowledgement(data), remote.port, remote.address)
		})
		const client = createClient(port)
		try {
			await client.connect()
			await withTimeout(client.sendReliableOrdered(Uint8Array.of(9)), 2_000)
			expect(attempts).toBe(2)
		} finally {
			await client.close()
			await close(server)
		}
	})

	test('fragments MTU-sized payloads and wraps reliable sequence numbers', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		const sequences: number[] = []
		let fragments = 0
		server.on('message', (data, remote) => {
			if (data[0] === CONNECT) {
				server.send(connectResponse(), remote.port, remote.address)
				return
			}
			if (data[0] !== RELIABLE_ORDERED) return
			sequences.push(sequenceOf(data))
			if ((data[1] ?? 0) & 1) fragments++
			server.send(acknowledgement(data), remote.port, remote.address)
		})
		const client = createClient(port, 512)
		try {
			await client.connect()
			await client.sendReliableOrdered(new Uint8Array(2_000).fill(7))
			for (let index = 0; index < 1_025; index++) {
				await client.sendReliableOrdered(Uint8Array.of(index & 0xff))
			}
			expect(fragments).toBeGreaterThan(1)
			expect(sequences.at(-2)).toBe(4)
			expect(sequences.at(-1)).toBe(5)
			expect(sequences).toContain(1023)
			expect(sequences.filter((sequence) => sequence === 0)).toHaveLength(2)
		} finally {
			await client.close()
			await close(server)
		}
	})

	test('closes on oversized incoming fragment metadata', async () => {
		const server = dgram.createSocket('udp4')
		const port = await bind(server)
		server.on('message', (data, remote) => {
			if (data[0] === CONNECT) {
				server.send(connectResponse(), remote.port, remote.address)
				return
			}
			if (data[0] !== CONNECTION_ESTABLISHED) return
			const fragment = new BitWriter()
			fragment.writeVariableUInt32(1)
			fragment.writeVariableUInt32(3 * 1024 * 1024 * 8)
			fragment.writeVariableUInt32(100)
			fragment.writeVariableUInt32(0)
			server.send(
				message(RELIABLE_ORDERED, fragment.toUint8Array(), fragment.bitLength, 0, true),
				remote.port,
				remote.address,
			)
		})
		const client = createClient(port)
		try {
			await client.connect()
			expect(await withTimeout(client.waitForClose().catch((error) => error))).toEqual(
				new Error('Malformed Lidgren message'),
			)
		} finally {
			await close(server)
		}
	})
})

function createClient(port: number, mtu?: number) {
	return new LidgrenClient({
		host: '127.0.0.1',
		port,
		mtu,
		hail: new Uint8Array(),
		onPayload: () => {},
	})
}

function connectResponse(applicationIdentifier = 'LoadBalancer', hail = new Uint8Array()) {
	const payload = new BitWriter()
	payload.writeString(applicationIdentifier)
	payload.writeInt64(0n)
	payload.writeFloat32(0)
	payload.writeBytes(hail)
	return message(CONNECT_RESPONSE, payload.toUint8Array(), payload.bitLength)
}

function acknowledgement(reliableMessage: Uint8Array) {
	const sequence = sequenceOf(reliableMessage)
	return message(
		ACKNOWLEDGE,
		Uint8Array.of(reliableMessage[0] ?? 0, sequence & 0xff, sequence >>> 8),
		24,
	)
}

function sequenceOf(message: Uint8Array) {
	return (((message[1] ?? 0) >>> 1) | ((message[2] ?? 0) << 7)) & 1023
}

function message(
	type: number,
	payload: Uint8Array,
	payloadBits: number,
	sequence = 0,
	fragmented = false,
) {
	const data = new Uint8Array(5 + payload.length)
	data[0] = type
	data[1] = ((sequence << 1) | (fragmented ? 1 : 0)) & 0xff
	data[2] = sequence >>> 7
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
