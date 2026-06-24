import { getDatabaseUrlForTooling } from '@zeepkist/core/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: getDatabaseUrlForTooling(),
	},
	strict: true,
	verbose: true,
})
