import '../upgrade/fetch'

// Test-only IPC instrumentation. Never copy this preload into the production artifact.
const maximumRss = 1_073_741_824
const watchdog = setInterval(() => {
	if (process.memoryUsage().rss > maximumRss) {
		console.error('SSR memory test exceeded 1 GiB RSS')
		process.exit(1)
	}
}, 250)
watchdog.unref()

let announcedTelemetry = false
process.on('message', async (message: unknown) => {
	if (typeof message !== 'object' || message === null || !('sample' in message)) return
	if (!announcedTelemetry && process.env.OTEL_SDK_DISABLED === 'false') {
		announcedTelemetry = true
		console.info('SSR memory test local collector enabled')
	}
	await Bun.sleep(25)
	Bun.gc(true)
	process.send?.({ sample: message.sample, memory: process.memoryUsage() })
})
