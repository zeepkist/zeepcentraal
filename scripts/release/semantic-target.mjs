import semanticRelease from 'semantic-release'

const dryRun = process.argv[2] === 'plan'
const result = await semanticRelease({ dryRun })
process.stdout.write(`ZC_RELEASE_RESULT=${JSON.stringify(result ? { version: result.nextRelease.version, tag: result.nextRelease.gitTag } : null)}\n`)
