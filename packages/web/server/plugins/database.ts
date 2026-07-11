import { closeDatabase } from '@zeepkist/database'

export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook('close', closeDatabase)
})
