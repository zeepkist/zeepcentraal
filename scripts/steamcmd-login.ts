import { execSync } from 'node:child_process'
import { createSteamCmdLoginArguments } from '../packages/workshop/src/steamCmd'

const username = process.env.STEAMCMD_USERNAME
const password = process.env.STEAMCMD_PASSWORD

if (!username || !password) {
	throw new Error('STEAMCMD_USERNAME and STEAMCMD_PASSWORD are required')
}

const args = (await createSteamCmdLoginArguments({ username, password })).join(' ')

execSync(`steamcmd ${args} +quit`, {
	stdio: 'inherit',
})
