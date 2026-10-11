"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Datum {
  label: string;
  value: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
      <div className="font-medium">{d.label}</div>
      <div className="tabular-nums text-muted-foreground">{d.value.toLocaleString()}</div>
    </div>
  );
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

/** Single-series bar/column chart with a table fallback. One hue, no legend (the title names the series). */
export function BarChartCard({
  title,
  description,
  data,
  layout = "column",
  valueLabel = "Problems",
  labelEvery,
  showValues = true,
}: {
  title: string;
  description?: string;
  data: Datum[];
  layout?: "column" | "bar";
  valueLabel?: string;
  labelEvery?: number;
  showValues?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const horizontal = layout === "bar";
  const height = horizontal ? Math.max(120, data.length * 34 + 16) : 200;

  return (
    <figure className="flex flex-col rounded-xl border bg-card p-4">
      <figcaption className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </figcaption>
      {total === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div aria-hidden style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {horizontal ? (
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tick={axisTick} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip />} />
                <Bar dataKey="value" fill="var(--chart-bar)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
                  {showValues && <LabelList dataKey="value" position="right" fill="var(--muted-foreground)" fontSize={11} />}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -20 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={axisTick}
                  interval={labelEvery ? labelEvery - 1 : 0}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip />} />
                <Bar dataKey="value" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                  {showValues && <LabelList dataKey="value" position="top" fill="var(--muted-foreground)" fontSize={11} />}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="py-1 font-medium">Item</th>
              <th scope="col" className="py-1 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
