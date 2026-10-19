import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
	// Keep browser tests separate from an existing local development server.
	buildDir: fileURLToPath(new URL('../../.nuxt/motion', import.meta.url)),
	vite: {
		cacheDir: fileURLToPath(new URL('../../.nuxt/motion/vite', import.meta.url)),
	},
})
