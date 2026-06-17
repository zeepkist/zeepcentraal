import { db } from '@zeepkist/database';
import { Elysia } from 'elysia';

export const withContext = new Elysia().decorate('db', db);
