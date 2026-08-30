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
const MAX_FRAGMENT_BYTES = 8 * 1024 * 1024
const FRAGMENT_TTL_MS = 30_000
const MAX_OUTGOING_BYTES = 64 * 1024 * 1024
const MAX_OUTGOING_TRANSFERS = 128
const SEQUENCE_MODULUS = 1024
const RECEIVE_WINDOW = 64
const SEND_WINDOW = 64
const DEFAULT_MTU = 1200
const RESEND_DELAY_MS = 500
const MAX_SEND_ATTEMPTS = 20
const DISCONNECT_FLUSH_TIMEOUT_MS = 500
const MAX_DISCONNECT_REASON_BYTES = 512

export type LidgrenDisconnectCategory =
	| 'afk'
	| 'credential-expired'
	| 'kicked'
	| 'remote'
	| 'timeout'

export class LidgrenRemoteDisconnectError extends Error {
	readonly category: LidgrenDisconnectCategory
	readonly reason: string

	constructor(reason: string) {
		const safeReason = sanitizeLidgrenDisconnectReason(reason)
		super(
			safeReason ? `Remote server disconnected: ${safeReason}` : 'Remote server disconnected',
		)
		this.name = 'LidgrenRemoteDisconnectError'
		this.reason = safeReason
		this.category = categorizeLidgrenDisconnectReason(safeReason)
	}
}

export interface LidgrenClientOptions {
	applicationIdentifier?: string
	hail: Uint8Array
	host: string
	mtu?: number
	onConnected?: (remoteHail: Uint8Array) => void
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
	createdAt: number
	totalBytes: number
}

interface OutgoingTransfer {
	chunkByteSize: number
	chunkCount: number
	groupId: number
	messageType: number
	nextChunk: number
	payload: Uint8Array
	reject: (error: Error) => void
	remaining: number
	resolve: () => void
}

interface PendingReliableMessage {
	attempts: number
	fragmented: boolean
	lastSentAt: number
	payload: Uint8Array
	payloadBits: number
	sequence: number
	transfer: OutgoingTransfer
	type: number
}

export class LidgrenClient {
	private socket: Socket | undefined
	private connected = false
	private closing = false
	private closed = false
	private closeError: Error | undefined
	private closePromise: Promise<void> | undefined
	private readonly expectedSequences = new Map<number, number>()
	private readonly withheld = new Map<number, Map<number, IncomingMessage>>()
	private readonly fragments = new Map<string, FragmentGroup>()
	private fragmentBytes = 0
	private handshakeTimer: ReturnType<typeof setInterval> | undefined
	private maintenanceTimer: ReturnType<typeof setInterval> | undefined
	private senderTimer: ReturnType<typeof setInterval> | undefined
	private handshakeAttempts = 0
	private lastReceivedAt = Date.now()
	private pingNumber = 0
	private lastPingAt = 0
	private readonly sendSequences = new Map<number, number>()
	private fragmentGroup = 1
	private readonly transferQueue: OutgoingTransfer[] = []
	private readonly outgoingTransfers = new Set<OutgoingTransfer>()
	private outgoingBytes = 0
	private readonly pendingReliable = new Map<string, PendingReliableMessage>()
	private readonly uniqueIdentifier = randomBytes(8).readBigInt64LE()
	private resolveConnected: (() => void) | undefined
	private rejectConnected: ((error: Error) => void) | undefined
	private readonly closedPromise: Promise<void>
	private readonly resolveClosed: () => void

	constructor(private readonly options: LidgrenClientOptions) {
		let resolveClosed: (() => void) | undefined
		this.closedPromise = new Promise<void>((resolve) => {
			resolveClosed = resolve
		})
		this.resolveClosed = () => resolveClosed?.()
	}

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

	async waitForClose() {
		await this.closedPromise
		if (this.closeError) {
			throw this.closeError
		}
	}

	close(reason = 'Client shutting down') {
		if (this.closePromise) {
			return this.closePromise
		}
		if (this.closing || this.closed) {
			return this.closedPromise
		}
		this.closing = true
		this.clearTimers()
		if (!this.connected) {
			this.rejectConnected?.(new Error('Lidgren client closed'))
		}
		this.closePromise = this.disconnectAndClose(reason)
		return this.closePromise
	}

	private sendConnect() {
		if (this.connected || this.closing || this.closed) {
			return
		}
		if (this.handshakeAttempts >= 5) {
			this.fail(new Error('Master server handshake timed out'))
			return
		}
		this.handshakeAttempts++
		const payload = new BitWriter()
		payload.writeString(this.applicationIdentifier)
		payload.writeInt64(this.uniqueIdentifier)
		payload.writeFloat32(nowSeconds())
		payload.writeBytes(this.options.hail)
		this.sendMessage(MESSAGE_TYPE.connect, payload.toUint8Array(), payload.bitLength)
	}

	private receiveDatagram(data: Buffer) {
		if (this.closing || this.closed || data.length > MAX_DATAGRAM_BYTES) {
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
				this.handleRemoteDisconnect(message.payload)
				break
			case MESSAGE_TYPE.acknowledge:
				this.receiveAcknowledgements(message.payload)
				break
			default:
				if (
					message.type >= MESSAGE_TYPE.reliableOrdered &&
					message.type < MESSAGE_TYPE.reliableOrdered + 32
				) {
					this.receiveReliableOrdered(message)
				}
		}
	}

	private handleRemoteDisconnect(payload: Uint8Array) {
		const reason =
			payload.byteLength === 0
				? ''
				: new BitReader(payload).readString(MAX_DISCONNECT_REASON_BYTES)
		this.fail(new LidgrenRemoteDisconnectError(reason))
	}

	private handleConnectResponse(payload: Uint8Array) {
		if (this.connected) {
			this.sendConnectionEstablished()
			return
		}
		const reader = new BitReader(payload)
		if (reader.readString(64) !== this.applicationIdentifier) {
			this.fail(new Error('Remote server application identifier mismatch'))
			return
		}
		reader.readInt64()
		reader.readFloat32()
		const remoteHail = reader.readBytes(Math.floor(reader.remainingBits / 8))
		this.options.onConnected?.(remoteHail)
		this.connected = true
		if (this.handshakeTimer) {
			clearInterval(this.handshakeTimer)
		}
		this.sendConnectionEstablished()
		this.maintenanceTimer = setInterval(() => this.maintainConnection(), 1_000)
		this.senderTimer = setInterval(() => this.maintainReliableSends(), 50)
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
		this.expireFragments(Date.now())
		if (Date.now() - this.lastReceivedAt > 25_000) {
			this.fail(new Error('Master server connection timed out'))
			return
		}
		if (Date.now() - this.lastPingAt >= 4_000) {
			this.lastPingAt = Date.now()
			const payload = Uint8Array.of(this.pingNumber++ & 0xff)
			this.sendMessage(MESSAGE_TYPE.ping, payload, 8)
		}
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
		const expectedSequence = this.expectedSequences.get(message.type) ?? 0
		const relative = relativeSequence(message.sequence, expectedSequence)
		if (relative < 0 || relative > RECEIVE_WINDOW) {
			return
		}
		if (relative > 0) {
			const withheld = this.withheld.get(message.type) ?? new Map<number, IncomingMessage>()
			withheld.set(message.sequence, message)
			this.withheld.set(message.type, withheld)
			return
		}

		this.release(message)
		let nextSequence = (expectedSequence + 1) % SEQUENCE_MODULUS
		const withheld = this.withheld.get(message.type)
		while (true) {
			const next = withheld?.get(nextSequence)
			if (!next) {
				break
			}
			withheld?.delete(nextSequence)
			this.release(next)
			nextSequence = (nextSequence + 1) % SEQUENCE_MODULUS
		}
		this.expectedSequences.set(message.type, nextSequence)
		if (withheld?.size === 0) this.withheld.delete(message.type)
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
		const fragmentKey = `${message.type}:${groupId}`
		if (!this.fragments.has(fragmentKey) && this.fragments.size >= MAX_FRAGMENT_GROUPS) {
			throw new Error('Too many Lidgren fragment groups')
		}
		const group = this.fragments.get(fragmentKey) ?? {
			totalBytes,
			chunkByteSize,
			chunks: new Map<number, Uint8Array>(),
			createdAt: Date.now(),
		}
		if (group.totalBytes !== totalBytes || group.chunkByteSize !== chunkByteSize) {
			throw new Error('Inconsistent Lidgren fragment group')
		}
		const expectedChunkBytes = Math.min(chunkByteSize, totalBytes - chunkNumber * chunkByteSize)
		const chunk = reader.readBytes(expectedChunkBytes)
		if (!group.chunks.has(chunkNumber)) {
			if (this.fragmentBytes + chunk.byteLength > MAX_FRAGMENT_BYTES) {
				throw new Error('Lidgren fragment memory limit exceeded')
			}
			group.chunks.set(chunkNumber, Uint8Array.from(chunk))
			this.fragmentBytes += chunk.byteLength
		}
		this.fragments.set(fragmentKey, group)
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
		this.deleteFragmentGroup(fragmentKey, group)
		this.options.onPayload(reassembled)
	}

	private expireFragments(now: number) {
		for (const [key, group] of this.fragments) {
			if (now - group.createdAt >= FRAGMENT_TTL_MS) this.deleteFragmentGroup(key, group)
		}
	}

	private deleteFragmentGroup(key: string, group: FragmentGroup) {
		if (!this.fragments.delete(key)) return
		for (const chunk of group.chunks.values()) this.fragmentBytes -= chunk.byteLength
		group.chunks.clear()
	}

	private sendAcknowledgement(type: number, sequence: number) {
		const payload = Uint8Array.of(type, sequence & 0xff, sequence >>> 8)
		this.sendMessage(MESSAGE_TYPE.acknowledge, payload, 24)
	}

	public sendReliableOrdered(payload: Uint8Array, sequenceChannel = 0) {
		if (!this.connected || this.closing || this.closed) {
			return Promise.reject(new Error('Lidgren client is not connected'))
		}
		if (
			payload.length > MAX_OUTGOING_BYTES ||
			this.outgoingBytes + payload.length > MAX_OUTGOING_BYTES ||
			this.outgoingTransfers.size >= MAX_OUTGOING_TRANSFERS
		) {
			return Promise.reject(new Error('Lidgren payload exceeds outgoing limit'))
		}
		const mtu = Math.max(512, this.options.mtu ?? DEFAULT_MTU)
		if (!Number.isInteger(sequenceChannel) || sequenceChannel < 0 || sequenceChannel > 31) {
			return Promise.reject(new Error('Invalid reliable sequence channel'))
		}
		const messageType = MESSAGE_TYPE.reliableOrdered + sequenceChannel
		const maxChunkBytes = mtu - 32
		const chunkCount = payload.length + 5 <= mtu ? 1 : Math.ceil(payload.length / maxChunkBytes)
		let resolve = () => {}
		let reject = (_error: Error) => {}
		const completion = new Promise<void>((complete, fail) => {
			resolve = complete
			reject = fail
		})
		const transfer: OutgoingTransfer = {
			chunkByteSize: maxChunkBytes,
			chunkCount,
			groupId: chunkCount === 1 ? 0 : this.nextFragmentGroup(),
			messageType,
			nextChunk: 0,
			payload,
			remaining: chunkCount,
			reject,
			resolve,
		}
		this.outgoingBytes += payload.byteLength
		this.outgoingTransfers.add(transfer)
		this.transferQueue.push(transfer)
		this.flushReliableQueue()
		return completion
	}

	private receiveAcknowledgements(payload: Uint8Array) {
		for (let offset = 0; offset + 2 < payload.length; offset += 3) {
			const type = payload[offset]
			const low = payload[offset + 1]
			const high = payload[offset + 2]
			if (type === undefined || low === undefined || high === undefined) continue
			const sequence = (low | (high << 8)) & 1023
			const pendingKey = reliableKey(type, sequence)
			const pending = this.pendingReliable.get(pendingKey)
			if (!pending || pending.type !== type) continue
			this.pendingReliable.delete(pendingKey)
			pending.transfer.remaining--
			if (pending.transfer.remaining === 0) {
				this.completeTransfer(pending.transfer)
			}
		}
		this.flushReliableQueue()
	}

	private maintainReliableSends() {
		if (this.closing || this.closed) return
		const now = Date.now()
		for (const pending of this.pendingReliable.values()) {
			if (now - pending.lastSentAt < RESEND_DELAY_MS) continue
			if (pending.attempts >= MAX_SEND_ATTEMPTS) {
				this.fail(new Error('Reliable Lidgren send timed out'))
				return
			}
			this.sendReliableMessage(pending)
		}
		this.flushReliableQueue()
	}

	private flushReliableQueue() {
		while (this.pendingReliable.size < SEND_WINDOW) {
			const transfer = this.transferQueue[0]
			if (!transfer) return
			const chunkNumber = transfer.nextChunk++
			const chunkOffset = chunkNumber * transfer.chunkByteSize
			const chunk = transfer.payload.subarray(
				chunkOffset,
				Math.min(transfer.payload.byteLength, chunkOffset + transfer.chunkByteSize),
			)
			let encodedPayload = chunk
			let payloadBits = chunk.byteLength * 8
			if (transfer.groupId !== 0) {
				const writer = new BitWriter()
				writer.writeVariableUInt32(transfer.groupId)
				writer.writeVariableUInt32(transfer.payload.byteLength * 8)
				writer.writeVariableUInt32(transfer.chunkByteSize)
				writer.writeVariableUInt32(chunkNumber)
				writer.writeBytes(chunk)
				encodedPayload = writer.toUint8Array()
				payloadBits = writer.bitLength
			}
			if (transfer.nextChunk >= transfer.chunkCount) this.transferQueue.shift()
			const sequence = this.sendSequences.get(transfer.messageType) ?? 0
			this.sendSequences.set(transfer.messageType, (sequence + 1) % SEQUENCE_MODULUS)
			const pending: PendingReliableMessage = {
				attempts: 0,
				fragmented: transfer.groupId !== 0,
				lastSentAt: 0,
				payload: encodedPayload,
				payloadBits,
				sequence,
				transfer,
				type: transfer.messageType,
			}
			this.pendingReliable.set(reliableKey(transfer.messageType, sequence), pending)
			this.sendReliableMessage(pending)
		}
	}

	private completeTransfer(transfer: OutgoingTransfer) {
		if (!this.outgoingTransfers.delete(transfer)) return
		this.outgoingBytes -= transfer.payload.byteLength
		transfer.resolve()
	}

	private sendReliableMessage(message: PendingReliableMessage) {
		message.attempts++
		message.lastSentAt = Date.now()
		this.sendMessage(
			message.type,
			message.payload,
			message.payloadBits,
			message.sequence,
			message.fragmented,
		)
	}

	private nextFragmentGroup() {
		const current = this.fragmentGroup
		this.fragmentGroup = this.fragmentGroup >= 0x7fff_ffff ? 1 : this.fragmentGroup + 1
		return current
	}

	private sendMessage(
		type: number,
		payload: Uint8Array,
		payloadBits: number,
		sequence = 0,
		fragmented = false,
	) {
		if (!this.socket || this.closed || payloadBits > 0xffff) {
			return
		}
		const data = new Uint8Array(5 + payload.length)
		data[0] = type
		data[1] = ((sequence << 1) | (fragmented ? 1 : 0)) & 0xff
		data[2] = sequence >>> 7
		data[3] = payloadBits & 0xff
		data[4] = payloadBits >>> 8
		data.set(payload, 5)
		this.socket.send(data)
	}

	private async disconnectAndClose(reason: string) {
		if (this.connected) {
			const payload = new BitWriter()
			payload.writeString(reason)
			await this.sendMessageAndWait(
				MESSAGE_TYPE.disconnect,
				payload.toUint8Array(),
				payload.bitLength,
			)
		}
		this.closeSocket()
		await this.closedPromise
	}

	private sendMessageAndWait(type: number, payload: Uint8Array, payloadBits: number) {
		return new Promise<void>((resolve) => {
			const socket = this.socket
			if (!socket || this.closed || payloadBits > 0xffff) {
				resolve()
				return
			}
			const data = new Uint8Array(5 + payload.length)
			data[0] = type
			data[1] = 0
			data[2] = 0
			data[3] = payloadBits & 0xff
			data[4] = payloadBits >>> 8
			data.set(payload, 5)

			let settled = false
			const finish = () => {
				if (settled) {
					return
				}
				settled = true
				clearTimeout(timeout)
				resolve()
			}
			const timeout = setTimeout(finish, DISCONNECT_FLUSH_TIMEOUT_MS)
			try {
				socket.send(data, finish)
			} catch {
				finish()
			}
		})
	}

	private fail(error: Error) {
		if (this.closing || this.closed) {
			return
		}
		this.closing = true
		this.closeError = error
		this.clearTimers()
		if (!this.connected) {
			this.rejectConnected?.(error)
		}
		this.rejectReliable(error)
		this.closeSocket()
	}

	private finishClosed() {
		if (this.closed) {
			return
		}
		this.closing = true
		this.closed = true
		this.clearTimers()
		this.rejectReliable(this.closeError ?? new Error('Lidgren client closed'))
		for (const [key, group] of this.fragments) this.deleteFragmentGroup(key, group)
		this.withheld.clear()
		this.expectedSequences.clear()
		this.sendSequences.clear()
		this.resolveClosed()
	}

	private closeSocket() {
		if (!this.socket) {
			this.finishClosed()
			return
		}
		try {
			this.socket.close()
		} catch {
			this.finishClosed()
		}
	}

	private clearTimers() {
		if (this.handshakeTimer) {
			clearInterval(this.handshakeTimer)
		}
		if (this.maintenanceTimer) {
			clearInterval(this.maintenanceTimer)
		}
		if (this.senderTimer) {
			clearInterval(this.senderTimer)
		}
	}

	private rejectReliable(error: Error) {
		for (const transfer of this.outgoingTransfers) transfer.reject(error)
		this.outgoingTransfers.clear()
		this.transferQueue.length = 0
		this.outgoingBytes = 0
		this.pendingReliable.clear()
	}

	private get applicationIdentifier() {
		return this.options.applicationIdentifier ?? 'LoadBalancer'
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.close()
	}
}

function relativeSequence(sequence: number, expected: number) {
	return (
		((sequence - expected + SEQUENCE_MODULUS + SEQUENCE_MODULUS / 2) % SEQUENCE_MODULUS) -
		SEQUENCE_MODULUS / 2
	)
}

function reliableKey(type: number, sequence: number) {
	return `${type}:${sequence}`
}

function nowSeconds() {
	return performance.now() / 1000
}

export function sanitizeLidgrenDisconnectReason(reason: string) {
	return [...reason]
		.map((character) => {
			const code = character.charCodeAt(0)
			return code < 32 || code === 127 ? ' ' : character
		})
		.join('')
		.replace(/\bbearer\s+\S+/gi, 'bearer [redacted]')
		.replace(/\b(bearer|token|ticket)\s*[=:]\s*\S+/gi, '$1=[redacted]')
		.replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[redacted]')
		.replace(/\b[A-Fa-f0-9]{32,}\b/g, '[redacted]')
		.replace(/\b[A-Za-z0-9_+/-]{48,}={0,2}\b/g, '[redacted]')
		.trim()
		.slice(0, 200)
}

function categorizeLidgrenDisconnectReason(reason: string): LidgrenDisconnectCategory {
	if (/\bafk\b/i.test(reason)) return 'afk'
	if (/token|ticket|credential|auth|expired/i.test(reason)) return 'credential-expired'
	if (/timeout|timed out|inactive/i.test(reason)) return 'timeout'
	if (/kick|ban|duplicate|already online/i.test(reason)) return 'kicked'
	return 'remote'
}
