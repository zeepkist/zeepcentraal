module.exports = {
	branches: ['develop'],
	// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
	tagFormat: '${version}',
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				preset: 'conventionalcommits',
				releaseRules: [
					{ breaking: true, release: 'major' },
					{ type: 'feat', release: 'minor' },
					{ type: 'fix', release: 'patch' },
					{ type: 'perf', release: 'patch' },
				],
			},
		],
		[
			'@semantic-release/release-notes-generator',
			{
				preset: 'conventionalcommits',
			},
		],
		[
			'@semantic-release/changelog',
			{
				changelogFile: 'CHANGELOG.md',
			},
		],
		[
			'@semantic-release/exec',
			{

				prepareCmd:
					// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
					'bun pm version ${nextRelease.version} --no-git-tag-version --allow-same-version',
			},
		],
		[
			'@semantic-release/git',
			{
				assets: ['CHANGELOG.md', 'package.json'],
				message:
					// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
					'chore(release): ${nextRelease.gitTag} [skip ci]\n\n${nextRelease.notes}',
			},
		],
	],
};
