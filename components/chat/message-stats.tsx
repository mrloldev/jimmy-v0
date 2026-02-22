"use client";

interface MessageStatsProps {
  stats: Record<string, unknown>;
}

function formatDuration(n: number): string {
  const sec = n > 0 && n < 1e3 ? n : n / 1e9;
  return `${sec.toFixed(sec >= 1 ? 2 : 3)}s`;
}

export function MessageStats({ stats }: MessageStatsProps) {
  const tokens = (stats.total_tokens ?? stats.decode_tokens ?? stats.prefill_tokens) as number | undefined;
  const duration = (stats.eval_duration ?? stats.total_duration ?? stats.total_time) as number | undefined;
  const rate = stats.decode_rate as number | undefined;

  const items: { label: string; value: string }[] = [];
  if (typeof tokens === "number") {
    items.push({ label: "Tokens", value: tokens.toLocaleString() });
  }
  if (typeof duration === "number") {
    items.push({ label: "Duration", value: formatDuration(duration) });
  }
  if (typeof rate === "number" && rate > 0) {
    items.push({ label: "Rate", value: `${rate.toFixed(1)} tok/s` });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
      {items.map(({ label, value }) => (
        <span key={label}>
          <span className="font-medium">{label}:</span> {value}
        </span>
      ))}
    </div>
  );
}
