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
			'@semantic-release/github',
			{
				successComment: true,
				failComment: true,
				releasedLabels: true,
			},
		],
	],
}
