interface SparklineBarsProps {
  values: number[];
  labels?: string[];
}

export function SparklineBars({ values, labels }: SparklineBarsProps) {
  const width = 220;
  const height = 40;
  const gap = 2;
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(...values, 1);
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend sparkline"
    >
      <title>Trend sparkline</title>
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * (height - 2));
        const x = i * (barWidth + gap);
        const y = height - h;
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: stable positional bars
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            fill="var(--green-11)"
            rx={1}
          >
            <title>{labels?.[i] ? `${labels[i]}: ${v}` : String(v)}</title>
          </rect>
        );
      })}
    </svg>
  );
}
