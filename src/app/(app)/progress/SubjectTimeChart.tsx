interface SubjectTimePoint {
  subjectId: string;
  subjectName: string;
  plannedMinutes: number;
  actualMinutes: number;
}

// Token values that Tailwind classes can't reach inside SVG paint attributes.
const GRID_STROKE = "rgba(148, 174, 214, 0.16)"; // border.DEFAULT
const AXIS_TEXT = "#8FA0C2"; // ink.muted
const PLANNED_COLOR = "#8B5CF6"; // violet.DEFAULT
const ACTUAL_COLOR = "#22D3EE"; // brand.DEFAULT

export function SubjectTimeChart({ data }: { data: SubjectTimePoint[] }) {
  const maxMinutes = Math.max(...data.flatMap((d) => [d.plannedMinutes, d.actualMinutes]), 1);
  const barWidth = 18;
  const gap = 6;
  const groupGap = 20;
  const chartHeight = 140;
  const groupWidth = barWidth * 2 + gap;

  const chartWidth = data.length * (groupWidth + groupGap);

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet" />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" />
          Actual
        </span>
      </div>
      <svg
        width={chartWidth}
        height={chartHeight + 32}
        role="img"
        aria-label="Planned versus actual study time by subject"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = chartHeight - fraction * chartHeight;
          return (
            <line
              key={`grid-${fraction}`}
              x1={0}
              x2={chartWidth}
              y1={y}
              y2={y}
              stroke={GRID_STROKE}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          );
        })}
        {data.map((point, i) => {
          const plannedHeight = (point.plannedMinutes / maxMinutes) * chartHeight;
          const actualHeight = (point.actualMinutes / maxMinutes) * chartHeight;
          const groupX = i * (groupWidth + groupGap);
          return (
            <g key={point.subjectId}>
              <rect x={groupX} y={chartHeight - plannedHeight} width={barWidth} height={plannedHeight} rx={4} fill={PLANNED_COLOR}>
                <title>
                  {point.subjectName} planned: {point.plannedMinutes} min
                </title>
              </rect>
              <text
                x={groupX + barWidth / 2}
                y={Math.max(chartHeight - plannedHeight - 4, 10)}
                textAnchor="middle"
                fontSize={9}
                fill={AXIS_TEXT}
              >
                {point.plannedMinutes}
              </text>
              <rect
                x={groupX + barWidth + gap}
                y={chartHeight - actualHeight}
                width={barWidth}
                height={actualHeight}
                rx={4}
                fill={ACTUAL_COLOR}
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
                fill={AXIS_TEXT}
              >
                {point.actualMinutes}
              </text>
              <text x={groupX + groupWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
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
