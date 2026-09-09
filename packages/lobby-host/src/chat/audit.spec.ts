import { expect, test } from 'bun:test'
import { formatChatAuditLine, resolveChatAuditLine } from './audit'

test('formats bounded one-line room-attributed chat audit records', () => {
	expect(formatChatAuditLine('totw', '[TAG] Player', 'hello')).toBe(
		'[chat] [totw] [TAG] Player: hello',
	)
	expect(formatChatAuditLine('totm', '\u001b[31mPlayer\nName', 'line 1\r\nline 2')).toBe(
		'[chat] [totm] Player Name: line 1 line 2',
	)
	expect(formatChatAuditLine('totw', '', '')).toBe('[chat] [totw] Unknown player: [empty]')
	expect(formatChatAuditLine('totw', 'Player', 'x'.repeat(5_000)).length).toBeLessThan(4_096)
	expect(formatChatAuditLine('totw', 'Player', '😀'.repeat(5_000)).length).toBeLessThan(4_096)
	const players = new Map([[42, '[TAG] Player']])
	expect(resolveChatAuditLine('totw', players, 42, 'hello', 7)).toBe(
		'[chat] [totw] [TAG] Player: hello',
	)
	expect(resolveChatAuditLine('totw', players, 99, 'hello', 7)).toBe(
		'[chat] [totw] Unknown player 99: hello',
	)
	expect(resolveChatAuditLine('totw', players, 0, 'system', 7)).toBeUndefined()
	expect(resolveChatAuditLine('totw', players, 7, 'local', 7)).toBeUndefined()
})
