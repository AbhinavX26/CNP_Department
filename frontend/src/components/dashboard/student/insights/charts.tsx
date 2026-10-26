import { useId } from 'react';

/** A "nice" top for the y axis so gridlines land on whole numbers. */
export function niceMax(max: number, steps = 4): number {
  if (max <= steps) return steps;
  const raw = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return step * steps;
}

const DEFAULT_W = 520;
const DEFAULT_H = 200;
const PAD = { top: 14, right: 14, bottom: 28, left: 30 };
const GRID_STEPS = 4;

function Grid({ yMax, W, H }: { yMax: number; W: number; H: number }) {
  const innerH = H - PAD.top - PAD.bottom;
  return (
    <>
      {Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
        const y = PAD.top + (innerH * i) / GRID_STEPS;
        const value = Math.round(yMax - (yMax * i) / GRID_STEPS);
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="sdx-chart-grid" />
            <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" className="sdx-chart-axis">
              {value}
            </text>
          </g>
        );
      })}
    </>
  );
}

export interface LinePoint {
  label: string;
  value: number;
  /** Tooltip text. */
  detail?: string;
}

/** Smooth line with a soft area fill. */
export function AreaLine({
  points,
  dark,
  light,
  ariaLabel,
  width: W = DEFAULT_W,
  height: H = DEFAULT_H,
}: {
  points: LinePoint[];
  dark: string;
  light: string;
  ariaLabel: string;
  width?: number;
  height?: number;
}) {
  const uid = useId();
  const fillId = `${uid}-fill`;
  const strokeId = `${uid}-stroke`;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMax = niceMax(Math.max(...points.map((p) => p.value), 0));
  const coords = points.map((p, i) => ({
    x: PAD.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1)),
    y: PAD.top + innerH * (1 - p.value / yMax),
  }));

  // Catmull-Rom -> cubic Bezier, with control points kept inside the plot.
  const clampY = (y: number) => Math.min(PAD.top + innerH, Math.max(PAD.top, y));
  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const baseline = PAD.top + innerH;
  const area = `${path} L ${coords[coords.length - 1].x} ${baseline} L ${coords[0].x} ${baseline} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sdx-chart" role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark} stopOpacity="0.34" />
          <stop offset="100%" stopColor={light} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={strokeId} gradientUnits="userSpaceOnUse" x1={PAD.left} y1="0" x2={W - PAD.right} y2="0">
          <stop offset="0%" stopColor={dark} />
          <stop offset="100%" stopColor={light} />
        </linearGradient>
      </defs>
      <Grid yMax={yMax} W={W} H={H} />
      <path d={area} fill={`url(#${fillId})`} />
      <path d={path} fill="none" stroke={`url(#${strokeId})`} strokeWidth="3" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={points[i].label}>
          <circle cx={c.x} cy={c.y} r="4.5" fill="#fff" stroke={i < points.length / 2 ? dark : light} strokeWidth="2.4">
            <title>{points[i].detail ?? `${points[i].label}: ${points[i].value}`}</title>
          </circle>
          <text x={c.x} y={H - 8} textAnchor="middle" className="sdx-chart-axis">
            {points[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** One data series, drawn as a gradient from a dark shade (top) to a light shade (bottom). */
export interface BarSeries {
  label: string;
  dark: string;
  light: string;
}

export interface BarGroup {
  label: string;
  values: number[];
}

/** Grouped vertical bars, one bar per series inside each group. */
export function GroupedBars({
  groups,
  series,
  ariaLabel,
  width: W = DEFAULT_W,
  height: H = DEFAULT_H,
}: {
  groups: BarGroup[];
  series: BarSeries[];
  ariaLabel: string;
  width?: number;
  height?: number;
}) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const yMax = niceMax(Math.max(...groups.flatMap((g) => g.values), 0));
  const groupW = innerW / groups.length;
  const barW = Math.min(26, (groupW * 0.62) / series.length);
  const gap = Math.min(8, barW * 0.35);
  const clusterW = barW * series.length + gap * (series.length - 1);
  const uid = useId();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sdx-chart" role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
      <defs>
        {series.map((item, i) => (
          <linearGradient key={item.label} id={`${uid}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={item.dark} />
            <stop offset="100%" stopColor={item.light} />
          </linearGradient>
        ))}
      </defs>
      <Grid yMax={yMax} W={W} H={H} />
      {groups.map((group, gi) => {
        const startX = PAD.left + groupW * gi + (groupW - clusterW) / 2;
        return (
          <g key={group.label}>
            {group.values.map((value, si) => {
              const h = (innerH * value) / yMax;
              const x = startX + si * (barW + gap);
              const y = PAD.top + innerH - h;
              return (
                <g key={series[si].label}>
                  {/* A zero value still draws a hairline so the series stays legible. */}
                  <rect
                    x={x}
                    y={value === 0 ? PAD.top + innerH - 2 : y}
                    width={barW}
                    height={value === 0 ? 2 : h}
                    rx={Math.min(6, barW / 2)}
                    fill={`url(#${uid}-bar-${si})`}
                    opacity={value === 0 ? 0.35 : 1}
                  >
                    <title>{`${group.label} · ${series[si].label}: ${value}`}</title>
                  </rect>
                  {value > 0 ? (
                    <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="sdx-chart-value">
                      {value}
                    </text>
                  ) : null}
                </g>
              );
            })}
            <text x={PAD.left + groupW * gi + groupW / 2} y={H - 8} textAnchor="middle" className="sdx-chart-axis">
              {group.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ items }: { items: BarSeries[] }) {
  return (
    <ul className="sdx-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className="sdx-legend-dot"
            style={{ background: `linear-gradient(160deg, ${item.dark}, ${item.light})` }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bar for table cells. `max` is the largest value in the column. */
export function MeterBar({ value, max, dark, light }: { value: number; max: number; dark: string; light: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <span className="sdx-meter" aria-hidden="true">
      <span className="sdx-meter-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${dark}, ${light})` }} />
    </span>
  );
}
