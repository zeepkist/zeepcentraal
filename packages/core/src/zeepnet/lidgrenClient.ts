import { randomBytes } from 'node:crypto'
import dgram, { type Socket } from 'node:dgram'
import { BitReader, BitWriter } from './binary'

const MESSAGE_TYPE = {
	ping: 129,
	pong: 130,
	connect: 131,
	connectResponse: 132,
	connectionEstablished: 133,
	acknowledge: 134,
	disconnect: 135,
	reliableOrdered: 67,
} as const

const MAX_DATAGRAM_BYTES = 2 * 1024 * 1024
const MAX_FRAGMENT_GROUPS = 32
const MAX_REASSEMBLED_BYTES = 2 * 1024 * 1024
const SEQUENCE_MODULUS = 1024
const RECEIVE_WINDOW = 64

interface LidgrenClientOptions {
	hail: Uint8Array
	host: string
	onPayload: (payload: Uint8Array) => void
	port: number
}

interface IncomingMessage {
	fragmented: boolean
	payload: Uint8Array
	sequence: number
	type: number
}

interface FragmentGroup {
	chunkByteSize: number
	chunks: Map<number, Uint8Array>
	totalBytes: number
}

export class LidgrenClient {
	private socket: Socket | undefined
	private connected = false
	private closed = false
	private expectedSequence = 0
	private readonly withheld = new Map<number, IncomingMessage>()
	private readonly fragments = new Map<number, FragmentGroup>()
	private handshakeTimer: ReturnType<typeof setInterval> | undefined
	private maintenanceTimer: ReturnType<typeof setInterval> | undefined
	private handshakeAttempts = 0
	private lastReceivedAt = Date.now()
	private pingNumber = 0
	private readonly uniqueIdentifier = randomBytes(8).readBigInt64LE()
	private resolveConnected: (() => void) | undefined
	private rejectConnected: ((error: Error) => void) | undefined
	private resolveClosed: (() => void) | undefined

	constructor(private readonly options: LidgrenClientOptions) {}

	connect() {
		if (this.socket) {
			throw new Error('Lidgren client already started')
		}
		const socket = dgram.createSocket('udp4')
		this.socket = socket
		socket.on('message', (data) => {
			try {
				this.receiveDatagram(data)
			} catch {
				this.fail(new Error('Malformed Lidgren message'))
			}
		})
		socket.on('error', () => this.fail(new Error('UDP transport error')))
		socket.on('close', () => this.finishClosed())
		socket.connect(this.options.port, this.options.host, () => {
			this.sendConnect()
			this.handshakeTimer = setInterval(() => this.sendConnect(), 3_000)
		})

		return new Promise<void>((resolve, reject) => {
			this.resolveConnected = resolve
			this.rejectConnected = reject
		})
	}

	waitForClose() {
		if (this.closed) {
			return Promise.resolve()
		}
		return new Promise<void>((resolve) => {
			this.resolveClosed = resolve
		})
	}

	close() {
		if (this.closed) {
			return
		}
		this.closed = true
		if (this.connected) {
			const payload = new BitWriter()
			payload.writeString('Client shutting down')
			this.sendMessage(MESSAGE_TYPE.disconnect, payload.toUint8Array(), payload.bitLength)
		}
		this.clearTimers()
		this.socket?.close()
	}

	private sendConnect() {
		if (this.connected || this.closed) {
			return
		}
		if (this.handshakeAttempts >= 5) {
			this.fail(new Error('Master server handshake timed out'))
			return
		}
		this.handshakeAttempts++
		const payload = new BitWriter()
		payload.writeString('LoadBalancer')
		payload.writeInt64(this.uniqueIdentifier)
		payload.writeFloat32(nowSeconds())
		payload.writeBytes(this.options.hail)
		this.sendMessage(MESSAGE_TYPE.connect, payload.toUint8Array(), payload.bitLength)
	}

	private receiveDatagram(data: Buffer) {
		if (this.closed || data.length > MAX_DATAGRAM_BYTES) {
			return
		}
		this.lastReceivedAt = Date.now()
		let offset = 0
		while (offset < data.length) {
			if (data.length - offset < 5) {
				this.fail(new Error('Malformed Lidgren datagram header'))
				return
			}
			const type = data[offset]
			const sequenceLow = data[offset + 1]
			const sequenceHigh = data[offset + 2]
			const bitsLow = data[offset + 3]
			const bitsHigh = data[offset + 4]
			if (
				type === undefined ||
				sequenceLow === undefined ||
				sequenceHigh === undefined ||
				bitsLow === undefined ||
				bitsHigh === undefined
			) {
				return
			}
			const payloadBits = bitsLow | (bitsHigh << 8)
			const payloadBytes = Math.ceil(payloadBits / 8)
			offset += 5
			if (payloadBytes > data.length - offset) {
				this.fail(new Error('Malformed Lidgren datagram payload'))
				return
			}
			const message: IncomingMessage = {
				type,
				sequence: ((sequenceLow >>> 1) | (sequenceHigh << 7)) & 1023,
				fragmented: (sequenceLow & 1) === 1,
				payload: data.subarray(offset, offset + payloadBytes),
			}
			offset += payloadBytes
			this.receiveMessage(message)
		}
	}

	private receiveMessage(message: IncomingMessage) {
		switch (message.type) {
			case MESSAGE_TYPE.connectResponse:
				this.handleConnectResponse(message.payload)
				break
			case MESSAGE_TYPE.ping:
				this.sendPong(message.payload)
				break
			case MESSAGE_TYPE.disconnect:
				this.fail(new Error('Master server disconnected'))
				break
			case MESSAGE_TYPE.reliableOrdered:
				this.receiveReliableOrdered(message)
				break
		}
	}

	private handleConnectResponse(payload: Uint8Array) {
		if (this.connected) {
			this.sendConnectionEstablished()
			return
		}
		const reader = new BitReader(payload)
		if (reader.readString(64) !== 'LoadBalancer') {
			this.fail(new Error('Master server application identifier mismatch'))
			return
		}
		reader.readInt64()
		reader.readFloat32()
		this.connected = true
		if (this.handshakeTimer) {
			clearInterval(this.handshakeTimer)
		}
		this.sendConnectionEstablished()
		this.maintenanceTimer = setInterval(() => this.maintainConnection(), 4_000)
		this.resolveConnected?.()
	}

	private sendConnectionEstablished() {
		const payload = new BitWriter()
		payload.writeFloat32(nowSeconds())
		this.sendMessage(
			MESSAGE_TYPE.connectionEstablished,
			payload.toUint8Array(),
			payload.bitLength,
		)
	}

	private maintainConnection() {
		if (Date.now() - this.lastReceivedAt > 25_000) {
			this.fail(new Error('Master server connection timed out'))
			return
		}
		const payload = Uint8Array.of(this.pingNumber++ & 0xff)
		this.sendMessage(MESSAGE_TYPE.ping, payload, 8)
	}

	private sendPong(payload: Uint8Array) {
		const pingNumber = payload[0]
		if (pingNumber === undefined) {
			return
		}
		const pong = new BitWriter()
		pong.writeByte(pingNumber)
		pong.writeFloat32(nowSeconds())
		this.sendMessage(MESSAGE_TYPE.pong, pong.toUint8Array(), pong.bitLength)
	}

	private receiveReliableOrdered(message: IncomingMessage) {
		this.sendAcknowledgement(message.type, message.sequence)
		const relative = relativeSequence(message.sequence, this.expectedSequence)
		if (relative < 0 || relative > RECEIVE_WINDOW) {
			return
		}
		if (relative > 0) {
			this.withheld.set(message.sequence, message)
			return
		}

		this.release(message)
		this.expectedSequence = (this.expectedSequence + 1) % SEQUENCE_MODULUS
		while (true) {
			const next = this.withheld.get(this.expectedSequence)
			if (!next) {
				break
			}
			this.withheld.delete(this.expectedSequence)
			this.release(next)
			this.expectedSequence = (this.expectedSequence + 1) % SEQUENCE_MODULUS
		}
	}

	private release(message: IncomingMessage) {
		if (!message.fragmented) {
			this.options.onPayload(message.payload)
			return
		}
		const reader = new BitReader(message.payload)
		const groupId = reader.readVariableUInt32()
		const totalBits = reader.readVariableUInt32()
		const chunkByteSize = reader.readVariableUInt32()
		const chunkNumber = reader.readVariableUInt32()
		const totalBytes = Math.ceil(totalBits / 8)
		if (
			totalBytes > MAX_REASSEMBLED_BYTES ||
			chunkByteSize < 1 ||
			chunkByteSize > MAX_REASSEMBLED_BYTES ||
			chunkNumber >= Math.ceil(totalBytes / chunkByteSize)
		) {
			throw new Error('Invalid Lidgren fragment metadata')
		}
		if (!this.fragments.has(groupId) && this.fragments.size >= MAX_FRAGMENT_GROUPS) {
			throw new Error('Too many Lidgren fragment groups')
		}
		const group = this.fragments.get(groupId) ?? {
			totalBytes,
			chunkByteSize,
			chunks: new Map<number, Uint8Array>(),
		}
		if (group.totalBytes !== totalBytes || group.chunkByteSize !== chunkByteSize) {
			throw new Error('Inconsistent Lidgren fragment group')
		}
		const expectedChunkBytes = Math.min(chunkByteSize, totalBytes - chunkNumber * chunkByteSize)
		group.chunks.set(chunkNumber, reader.readBytes(expectedChunkBytes))
		this.fragments.set(groupId, group)
		const chunkCount = Math.ceil(totalBytes / chunkByteSize)
		if (group.chunks.size !== chunkCount) {
			return
		}
		const reassembled = new Uint8Array(totalBytes)
		for (let index = 0; index < chunkCount; index++) {
			const chunk = group.chunks.get(index)
			if (!chunk) {
				return
			}
			reassembled.set(chunk, index * chunkByteSize)
		}
		this.fragments.delete(groupId)
		this.options.onPayload(reassembled)
	}

	private sendAcknowledgement(type: number, sequence: number) {
		const payload = Uint8Array.of(type, sequence & 0xff, sequence >>> 8)
		this.sendMessage(MESSAGE_TYPE.acknowledge, payload, 24)
	}

	private sendMessage(type: number, payload: Uint8Array, payloadBits: number) {
		if (!this.socket || this.closed || payloadBits > 0xffff) {
			return
		}
		const data = new Uint8Array(5 + payload.length)
		data[0] = type
		data[1] = 0
		data[2] = 0
		data[3] = payloadBits & 0xff
		data[4] = payloadBits >>> 8
		data.set(payload, 5)
		this.socket.send(data)
	}

	private fail(error: Error) {
		if (this.closed) {
			return
		}
		this.closed = true
		this.clearTimers()
		if (!this.connected) {
			this.rejectConnected?.(error)
		}
		this.socket?.close()
	}

	private finishClosed() {
		this.closed = true
		this.clearTimers()
		this.resolveClosed?.()
	}

	private clearTimers() {
		if (this.handshakeTimer) {
			clearInterval(this.handshakeTimer)
		}
		if (this.maintenanceTimer) {
			clearInterval(this.maintenanceTimer)
		}
	}
}

function relativeSequence(sequence: number, expected: number) {
	return (
		((sequence - expected + SEQUENCE_MODULUS + SEQUENCE_MODULUS / 2) % SEQUENCE_MODULUS) -
		SEQUENCE_MODULUS / 2
	)
}

function nowSeconds() {
	return performance.now() / 1000
}
