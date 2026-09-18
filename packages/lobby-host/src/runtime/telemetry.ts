import { getMeter } from '@zeepkist/telemetry'
export const meter = getMeter('zeepcentraal-lobby-host')
export const assignmentLatency = meter.createHistogram(
	'zeepkist.managed_room.assignment.duration',
	{ description: 'Room broker assignment latency', unit: 'ms' },
)
export const reconnects = meter.createCounter('zeepkist.managed_room.reconnects', {
	description: 'Failed room connections followed by retry',
})
export const recoveryDuration = meter.createHistogram('zeepkist.managed_room.recovery.duration', {
	description: 'Time from first room failure until readiness is restored',
	unit: 'ms',
})
export const connectionDuration = meter.createHistogram(
	'zeepkist.managed_room.connection.duration',
	{ description: 'GameServer connection lifetime', unit: 'ms' },
)
export const eventLoopDelay = meter.createHistogram('zeepkist.lobby_host.event_loop.delay', {
	description: 'Observed lobby-host event-loop scheduling delay',
	unit: 'ms',
})
export const afkDisconnects = meter.createCounter('zeepkist.managed_room.disconnects.afk', {
	description: 'GameServer disconnects categorized as AFK',
})
export function roomLogger(key: string) {
	return {
		info: (message: string) => console.info(`[${key}] ${message}`),
		warn: (message: string) => console.warn(`[${key}] ${message}`),
	}
}
