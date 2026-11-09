import { defineConfig } from 'vitest/config'
import config from './vitest.config.ts'

export default defineConfig({
	...config,
	define: { 'import.meta.server': true, 'import.meta.client': false },
	test: {
		...config.test,
		include: ['tests/ssr/**/*.spec.ts', 'tests/unit/admin-middleware.spec.ts'],
	},
})
