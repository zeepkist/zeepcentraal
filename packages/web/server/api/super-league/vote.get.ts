import { readContestBackend } from '../../utils/contest-read'

export default defineEventHandler((event) => readContestBackend(event, '/super-league/vote'))
