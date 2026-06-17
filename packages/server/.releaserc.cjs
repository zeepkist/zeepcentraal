module.exports = {
	extends: ['semantic-release-monorepo', '../../release.config.cjs'],
	tagFormat: 'server@${version}',
};
