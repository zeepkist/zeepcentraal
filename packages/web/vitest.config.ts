import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			'~': fileURLToPath(new URL('./app', import.meta.url)),
		},
	},
	test: {
		silent: 'passed-only',
		deps: {
			interopDefault: false,
		},
		environment: 'node',
		include: ['tests/unit/**/*.spec.ts'],
	},
})
