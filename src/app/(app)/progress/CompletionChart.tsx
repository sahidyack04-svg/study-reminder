import { formatUTCDate } from "@/lib/validation/age";

interface CompletionPoint {
  date: Date;
  percentDone: number;
}

// Token values that Tailwind classes can't reach inside SVG paint attributes.
const GRID_STROKE = "rgba(148, 174, 214, 0.16)"; // border.DEFAULT
const AXIS_TEXT = "#8FA0C2"; // ink.muted
const SERIES_COLOR = "#22D3EE"; // brand.DEFAULT

export function CompletionChart({ data }: { data: CompletionPoint[] }) {
  const barWidth = 28;
  const gap = 8;
  const chartHeight = 120;
  const width = data.length * (barWidth + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={chartHeight + 24} role="img" aria-label="Daily study completion percentage">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = chartHeight - (tick / 100) * chartHeight;
          return (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke={GRID_STROKE}
              strokeWidth={1}
              shapeRendering="crispEdges"
            />
          );
        })}
        {data.map((point, i) => {
          const barHeight = (point.percentDone / 100) * chartHeight;
          const opacity = Math.max(0.15, point.percentDone / 100);
          const x = i * (barWidth + gap);
          return (
            <g key={point.date.toISOString()}>
              <rect
                x={x}
                y={chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={SERIES_COLOR}
                fillOpacity={opacity}
              >
                <title>
                  {formatUTCDate(point.date)}: {point.percentDone}% done
                </title>
              </rect>
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                {point.percentDone}%
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Daily study completion percentage</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Percent done</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date.toISOString()}>
              <td>{formatUTCDate(point.date)}</td>
              <td>{point.percentDone}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
