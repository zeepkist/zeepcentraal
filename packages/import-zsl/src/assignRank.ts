type RankablePoints = { points: number };
type RankablePointsAndTime = RankablePoints & { time: number };

export function assignRank<
	HasTime extends boolean,
	T extends HasTime extends true ? RankablePointsAndTime : RankablePoints,
>(rows: T[], options?: { useTime?: HasTime }): (T & { position: number })[] {
	if (rows.length === 0 || !rows[0]) return [];

	const firstRow = rows[0];

	let rank = 1;
	let lastPoints = firstRow.points;
	let lastTime: number | undefined =
		options?.useTime && 'time' in firstRow ? firstRow.time : undefined;

	rows.sort((a, b) => {
		if (a.points !== b.points) {
			return b.points - a.points;
		}

		if (options?.useTime && 'time' in a && 'time' in b) {
			return a.time - b.time;
		}

		return 0;
	});

	return rows.map((row, idx) => {
		if (idx === 0) {
			return { ...row, position: rank };
		}

		const pointsEqual = row.points === lastPoints;
		const timeEqual =
			options?.useTime && 'time' in row ? row.time === (lastTime as number) : false;

		if (pointsEqual && (!options?.useTime || timeEqual)) {
			return { ...row, position: rank };
		}

		rank = idx + 1;
		lastPoints = row.points;

		if (options?.useTime && 'time' in row) {
			lastTime = row.time;
		}

		return { ...row, position: rank };
	});
}
