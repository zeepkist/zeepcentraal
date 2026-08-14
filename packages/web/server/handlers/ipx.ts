import { createIpxWebHandler, type IpxRuntimeOptions } from '../utils/ipx'

/**
 * IPX hard-codes a hard dependency on srvx/node binaries, instead of using the environment-relevant native binaries,
 * e.g srvx/bun. This is a workaround to ensure that the correct binaries are used in production.
 */
export default defineLazyEventHandler(() => {
	const options = useRuntimeConfig().ipx as IpxRuntimeOptions
	const handler = createIpxWebHandler(options)

	return fromWebHandler(async (request) => handler(request))
})
