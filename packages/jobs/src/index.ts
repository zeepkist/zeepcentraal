import cluster from 'node:cluster';
import { config } from '@zeepkist/core';
import { makeWorkerUtils } from 'graphile-worker';
import { defaultJobOptions, startCrons, startRunner, stopCrons, stopRunner } from './worker';

const WORKER_COUNT = 2;

if (cluster.isPrimary) {
	process.title = 'zeepcentraal-jobs: primary';
	// The primary process manages cron scheduling only — no task processing.
	// Using makeWorkerUtils keeps it lightweight (add-only, no task runner).
	const utils = await makeWorkerUtils({ connectionString: config.databaseUrl });
	startCrons((task, payload, spec) => utils.addJob(task, payload, spec));

	console.info(`Jobs primary (PID ${process.pid}) started, forking ${WORKER_COUNT} workers...`);

	for (let i = 0; i < WORKER_COUNT; i++) {
		cluster.fork();
	}

	cluster.on('exit', (worker) => {
		console.warn(`Job worker ${worker.process.pid} died, restarting...`);
		cluster.fork();
	});

	async function shutdownPrimary(signal: string) {
		console.info(`Received ${signal}, shutting down jobs primary...`);
		stopCrons();
		await utils.release();
		process.exit(0);
	}

	process.on('SIGINT', () => void shutdownPrimary('SIGINT'));
	process.on('SIGTERM', () => void shutdownPrimary('SIGTERM'));
} else {
	process.title = 'zeepcentraal-jobs: worker';
	// Each worker process runs a full graphile-worker runner for task processing.
	await startRunner();

	async function shutdownWorker(signal: string) {
		console.info(`Job worker ${process.pid} received ${signal}, shutting down...`);
		await stopRunner();
		process.exit(0);
	}

	process.on('SIGINT', () => void shutdownWorker('SIGINT'));
	process.on('SIGTERM', () => void shutdownWorker('SIGTERM'));
}
