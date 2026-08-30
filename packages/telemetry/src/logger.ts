import { format } from 'node:util'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import type { TelemetryAttributes } from './span'

const logger = logs.getLogger('zeepcentraal')
const originalConsole = {
	debug: console.debug.bind(console),
	info: console.info.bind(console),
	log: console.log.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
}
let restoreConsole: (() => void) | undefined

export type TelemetryLogLevel = 'debug' | 'info' | 'warn' | 'error'

const severity = {
	debug: SeverityNumber.DEBUG,
	info: SeverityNumber.INFO,
	warn: SeverityNumber.WARN,
	error: SeverityNumber.ERROR,
} as const

export function emitTelemetryLog(
	level: TelemetryLogLevel,
	message: string,
	attributes?: TelemetryAttributes,
	options: { printAttributes?: boolean } = {},
) {
	const safeMessage = redactLogMessage(message)
	logger.emit({
		severityNumber: severity[level],
		severityText: level.toUpperCase(),
		body: safeMessage,
		attributes,
	})
	const sink =
		level === 'error'
			? originalConsole.error
			: level === 'warn'
				? originalConsole.warn
				: originalConsole.info
	if (attributes && options.printAttributes !== false) sink(safeMessage, attributes)
	else sink(safeMessage)
}

export function redactLogMessage(message: string) {
	return message
		.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
		.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[redacted]@')
		.replace(
			/([?&](?:access[_-]?token|api[_-]?key|key|password|secret|signature|token)=)[^&\s]+/gi,
			'$1[redacted]',
		)
		.replace(
			/(\b(?:access[_-]?token|api[_-]?key|password|secret|signature|token)=)[^\s,;&]+/gi,
			'$1[redacted]',
		)
		.slice(0, 4_096)
}

function logBody(values: unknown[]) {
	if (values.length === 0) return 'Structured application log'
	return redactLogMessage(format(...values))
}

export function installTelemetryConsoleBridge() {
	if (restoreConsole) return
	const previous = {
		debug: console.debug,
		info: console.info,
		log: console.log,
		warn: console.warn,
		error: console.error,
	}
	const bridge =
		(level: TelemetryLogLevel, sink: (...values: unknown[]) => void) =>
		(...values: unknown[]) => {
			sink(...values)
			logger.emit({
				severityNumber: severity[level],
				severityText: level.toUpperCase(),
				body: logBody(values),
				attributes: { 'log.argument.count': values.length },
			})
		}
	console.debug = bridge('debug', originalConsole.debug)
	console.info = bridge('info', originalConsole.info)
	console.log = bridge('info', originalConsole.log)
	console.warn = bridge('warn', originalConsole.warn)
	console.error = bridge('error', originalConsole.error)
	restoreConsole = () => {
		console.debug = previous.debug
		console.info = previous.info
		console.log = previous.log
		console.warn = previous.warn
		console.error = previous.error
		restoreConsole = undefined
	}
}

export function uninstallTelemetryConsoleBridge() {
	restoreConsole?.()
}
