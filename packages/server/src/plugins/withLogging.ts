import { serverConfig } from '@zeepkist/core/config/server'
import logixlysia, { type LogLevel } from 'logixlysia'

const IS_PRODUCTION = serverConfig.nodeEnv === 'production'
const logLevels: LogLevel[] = ['ERROR', 'WARNING', 'INFO']

if (!IS_PRODUCTION) {
	logLevels.push('DEBUG')
}

// https://elysiajs.com/plugins/logging
export const withLogging = logixlysia({
	config: {
		showStartupMessage: false,
		startupMessageFormat: 'banner',
		timestamp: {
			translateTime: 'yyyy-mm-dd HH:MM:ss.SSS',
		},
		ip: true,
		disableFileLogging: IS_PRODUCTION,
		logFilePath: './logs/api.log',
		logRotation: {
			maxSize: '10m',
			interval: '1d',
			maxFiles: '7d',
			compress: true,
		},
		logFilter: {
			level: logLevels,
		},
		requestId: false,
		slowThreshold: 500,
		verySlowThreshold: 1000,
		showContextTree: true,
		contextDepth: 3,
		customLogFormat: '{now} {level}\t{method}\t{status} {pathname} {duration} {speed} {ip}',
	},
})
