interface CompletionPoint {
  date: Date;
  percentDone: number;
}

export function CompletionChart({ data }: { data: CompletionPoint[] }) {
  const barWidth = 28;
  const gap = 8;
  const chartHeight = 120;
  const width = data.length * (barWidth + gap);

  return (
    <div>
      <svg width={width} height={chartHeight + 24} role="img" aria-label="Daily study completion percentage">
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
                fill="#e87ba4"
                fillOpacity={opacity}
              >
                <title>
                  {point.date.toLocaleDateString()}: {point.percentDone}% done
                </title>
              </rect>
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill="#52514e">
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
              <td>{point.date.toLocaleDateString()}</td>
              <td>{point.percentDone}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
