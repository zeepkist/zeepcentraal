import { config } from '@zeepkist/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(config.databaseUrl, {
	max: 20,
	idle_timeout: 30,
});

export const db = drizzle(client, { schema });

export { schema };
export * from './services';
