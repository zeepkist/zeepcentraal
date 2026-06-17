import cors from '@elysiajs/cors'
import { Elysia } from 'elysia'

export const withCors = new Elysia().use(
	cors({
		origin: true,
		credentials: true,
	}),
)
