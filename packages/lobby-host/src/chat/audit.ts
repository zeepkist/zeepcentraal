const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
function sanitizeAuditText(value: string, maxLength: number, fallback: string) {
	const sanitized = value
		.replace(ANSI_SEQUENCE_PATTERN, '')
		.replace(/[\p{Cc}\p{Cf}]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	let result = ''
	for (const character of sanitized) {
		if (result.length + character.length > maxLength) break
		result += character
	}
	return result || fallback
}
export function formatChatAuditLine(roomKey: string, playerName: string, message: string) {
	return `[chat] [${roomKey}] ${sanitizeAuditText(playerName, 256, 'Unknown player')}: ${sanitizeAuditText(message, 3_700, '[empty]')}`
}
export function resolveChatAuditLine(
	roomKey: string,
	players: ReadonlyMap<number, string>,
	senderUid: number,
	message: string,
	localUid: number,
) {
	if (senderUid === 0 || senderUid === localUid) return undefined
	return formatChatAuditLine(
		roomKey,
		players.get(senderUid) ?? `Unknown player ${senderUid}`,
		message,
	)
}
