import { closeDatabase } from '@zeepkist/database'
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook('close', closeDatabase)
})
