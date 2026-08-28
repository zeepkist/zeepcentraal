import { serverConfig } from '@zeepkist/core/config/server'
import { createElysiaRequestLoggingPlugin } from '@zeepkist/telemetry'

export const withLogging = createElysiaRequestLoggingPlugin({
	trustProxy: serverConfig.http.trustProxy,
})
