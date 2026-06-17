import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const workspaceRoot = process.cwd();
const packageDirs = ['core', 'database', 'server', 'jobs', 'import-zsl'] as const;

type PackageRelease = {
	dir: string;
	tag: string;
	name: string;
	version: string;
	notes: string[];
};

function readPackageMeta(dir: string) {
	const packageJsonPath = path.join(workspaceRoot, 'packages', dir, 'package.json');
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
		name: string;
		version: string;
	};

	return {
		dir,
		name: packageJson.name,
		version: packageJson.version,
	};
}

function extractLatestPackageNotes(dir: string): string[] {
	const changelogPath = path.join(workspaceRoot, 'packages', dir, 'CHANGELOG.md');
	if (!existsSync(changelogPath)) {
		return [];
	}

	const changelog = readFileSync(changelogPath, 'utf8');
	const lines = changelog.split(/\r?\n/);
	const firstVersionHeading = lines.findIndex((line) => line.startsWith('## '));
	if (firstVersionHeading === -1) {
		return [];
	}

	const nextVersionHeading = lines
		.slice(firstVersionHeading + 1)
		.findIndex((line) => line.startsWith('## '));

	const endIndex =
		nextVersionHeading === -1 ? lines.length : firstVersionHeading + 1 + nextVersionHeading;

	return lines
		.slice(firstVersionHeading, endIndex)
		.filter((line) => line.trim().length > 0)
		.map((line) => line.replace(/^##\s*/, '').trim());
}

function buildReleaseRows(releases: PackageRelease[]): string[] {
	return releases.map((release) => {
		const headline = `- ${release.tag}`;
		const notes = release.notes
			.slice(0, 4)
			.filter((line) => !line.startsWith('['))
			.map((line) => `  - ${line}`);

		return [headline, ...notes].join('\n');
	});
}

function readReleaseTagsFromGit(): Set<string> {
	const fromSha = process.env.RELEASE_FROM_SHA?.trim();
	if (!fromSha) {
		return new Set<string>();
	}

	let logOutput = '';
	try {
		logOutput = execSync(`git log --format=%s ${fromSha}..HEAD`, {
			cwd: workspaceRoot,
			encoding: 'utf8',
		});
	} catch {
		return new Set<string>();
	}

	const tags = new Set<string>();
	for (const line of logOutput.split(/\r?\n/)) {
		const match = line.match(/^chore\(release\):\s+([^\s]+@\d+\.\d+\.\d+)/);
		if (match && match[1]) {
			tags.add(match[1]);
		}
	}

	return tags;
}

function main() {
	const releasedTags = readReleaseTagsFromGit();
	if (releasedTags.size === 0) {
		return;
	}

	const releaseDate = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
	const releases: PackageRelease[] = packageDirs.map((dir) => {
		const meta = readPackageMeta(dir);
		const packageAlias = meta.name.split('/').pop() ?? meta.name;
		const tag = `${packageAlias}@${meta.version}`;
		return {
			dir,
			tag,
			name: meta.name,
			version: meta.version,
			notes: extractLatestPackageNotes(dir),
		};
	}).filter((release) => releasedTags.has(release.tag));

	if (releases.length === 0) {
		return;
	}

	const rootChangelogPath = path.join(workspaceRoot, 'CHANGELOG.md');
	const existing = existsSync(rootChangelogPath)
		? readFileSync(rootChangelogPath, 'utf8')
		: '# Changelog\n\n';

	const releaseTitle = `## Release ${releaseDate}`;
	if (existing.includes(releaseTitle)) {
		return;
	}

	const summaryLines = [
		releaseTitle,
		'',
		...buildReleaseRows(releases),
		'',
	].join('\n');

	const updated = existing.startsWith('# Changelog')
		? existing.replace(/^# Changelog\s*/m, '# Changelog\n\n' + summaryLines)
		: '# Changelog\n\n' + summaryLines + existing;

	writeFileSync(rootChangelogPath, updated, 'utf8');
}

main();
