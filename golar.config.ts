import { defineConfig } from 'golar/unstable'

export default defineConfig({
	typecheck: {
		include: ['packages/**/*.ts', 'scripts/**/*.ts', 'test/**/*.ts'],
		exclude: ['packages/web/**'],
	},
})
