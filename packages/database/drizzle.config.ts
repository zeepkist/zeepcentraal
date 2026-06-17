import { defineConfig } from 'drizzle-kit';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function getDatabaseUrl() {
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	const rootEnvPath = resolve(process.cwd(), '../../.env');
	if (existsSync(rootEnvPath)) {
		for (const line of readFileSync(rootEnvPath, 'utf8').split(/\r?\n/)) {
			if (line.startsWith('DATABASE_URL=')) {
				return line.slice('DATABASE_URL='.length).trim();
			}
		}
	}

	return 'postgres://postgres:postgres@localhost:5432/zeepkist';
}

export default defineConfig({
	schema: './src/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: getDatabaseUrl(),
	},
	strict: true,
	verbose: true,
});
