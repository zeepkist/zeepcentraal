export function isEventAfterCursor(eventId: string, cursorEventId: string) {
	return BigInt(eventId) > BigInt(cursorEventId)
}
