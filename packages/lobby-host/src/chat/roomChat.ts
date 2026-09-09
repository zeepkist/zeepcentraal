import { chatMessagePacket, targetedChatMessagePacket } from '@zeepkist/core/zeepnet'

export class RoomChat {
	constructor(private readonly send: (packet: Uint8Array) => Promise<void>) {}
	command(message: string) {
		return this.send(chatMessagePacket(message))
	}
	target(steamId: bigint, message: string, hostname: string) {
		return this.send(targetedChatMessagePacket(steamId, message, hostname))
	}
}
