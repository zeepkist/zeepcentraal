import { z } from 'zod'
import { type EnvSource, nodeEnvSchema } from './shared'

const discordBotEnvSchema = z.object({
	NODE_ENV: nodeEnvSchema,
	DISCORD_CLIENT_ID: z.string().min(1),
	DISCORD_BOT_TOKEN: z.string().min(1),
	DISCORD_BOT_API_TOKEN: z.string().min(32),
	DISCORD_DEVELOPMENT_GUILD_ID: z.string().min(1).optional(),
	DISCORD_GRAPHQL_HTTP_URL: z.url().default('https://graphql.zeepki.st'),
	DISCORD_GRAPHQL_WS_URL: z.url().default('wss://graphql.zeepki.st'),
	DISCORD_BACKEND_URL: z.url().default('https://backend.zeepki.st'),
	DISCORD_FRONTEND_URL: z.url().default('https://zeepki.st'),
	DISCORD_HOST: z.string().default('0.0.0.0'),
	DISCORD_PORT: z.coerce.number().int().positive().default(3000),
	DISCORD_REGISTER_COMMANDS: z.stringbool().default(true),
})

export function parseDiscordBotConfig(env: EnvSource) {
	const parsed = discordBotEnvSchema.parse(env)
	return {
		nodeEnv: parsed.NODE_ENV,
		clientId: parsed.DISCORD_CLIENT_ID,
		botToken: parsed.DISCORD_BOT_TOKEN,
		apiToken: parsed.DISCORD_BOT_API_TOKEN,
		developmentGuildId: parsed.DISCORD_DEVELOPMENT_GUILD_ID,
		graphql: {
			httpUrl: parsed.DISCORD_GRAPHQL_HTTP_URL,
			wsUrl: parsed.DISCORD_GRAPHQL_WS_URL,
		},
		backendUrl: parsed.DISCORD_BACKEND_URL,
		frontendUrl: parsed.DISCORD_FRONTEND_URL,
		health: {
			host: parsed.DISCORD_HOST,
			port: parsed.DISCORD_PORT,
		},
		registerCommands: parsed.DISCORD_REGISTER_COMMANDS,
	} as const
}
