interface SubjectTimePoint {
  subjectId: string;
  subjectName: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export function SubjectTimeChart({ data }: { data: SubjectTimePoint[] }) {
  const maxMinutes = Math.max(...data.flatMap((d) => [d.plannedMinutes, d.actualMinutes]), 1);
  const barWidth = 18;
  const gap = 6;
  const groupGap = 20;
  const chartHeight = 140;
  const groupWidth = barWidth * 2 + gap;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "#4a3aa7" }} />
          Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "#e87ba4" }} />
          Actual
        </span>
      </div>
      <svg
        width={data.length * (groupWidth + groupGap)}
        height={chartHeight + 32}
        role="img"
        aria-label="Planned versus actual study time by subject"
      >
        {data.map((point, i) => {
          const plannedHeight = (point.plannedMinutes / maxMinutes) * chartHeight;
          const actualHeight = (point.actualMinutes / maxMinutes) * chartHeight;
          const groupX = i * (groupWidth + groupGap);
          return (
            <g key={point.subjectId}>
              <rect x={groupX} y={chartHeight - plannedHeight} width={barWidth} height={plannedHeight} rx={4} fill="#4a3aa7">
                <title>
                  {point.subjectName} planned: {point.plannedMinutes} min
                </title>
              </rect>
              <text
                x={groupX + barWidth / 2}
                y={Math.max(chartHeight - plannedHeight - 4, 10)}
                textAnchor="middle"
                fontSize={9}
                fill="#52514e"
              >
                {point.plannedMinutes}
              </text>
              <rect
                x={groupX + barWidth + gap}
                y={chartHeight - actualHeight}
                width={barWidth}
                height={actualHeight}
                rx={4}
                fill="#e87ba4"
              >
                <title>
                  {point.subjectName} actual: {point.actualMinutes} min
                </title>
              </rect>
              <text
                x={groupX + barWidth + gap + barWidth / 2}
                y={Math.max(chartHeight - actualHeight - 4, 10)}
                textAnchor="middle"
                fontSize={9}
                fill="#52514e"
              >
                {point.actualMinutes}
              </text>
              <text x={groupX + groupWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill="#52514e">
                {point.subjectName}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Planned versus actual study time by subject, in minutes</caption>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Planned minutes</th>
            <th>Actual minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.subjectId}>
              <td>{point.subjectName}</td>
              <td>{point.plannedMinutes}</td>
              <td>{point.actualMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
