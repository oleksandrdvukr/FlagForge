interface BucketGridProps {
  /** Buckets 0..percentage-1 are in the rollout (`bucket < percentageRollout`). */
  percentage: number;
  /** Optional bucket to mark, e.g. where a specific user lands. */
  highlight?: number | null;
  /** Dims the grid when the master switch is off: no bucket is served. */
  disabled?: boolean;
}

/**
 * The 100 deterministic rollout buckets (ADR-0004), drawn as a 10×10 grid so a
 * percentage reads as "these users", not an abstract number.
 */
export function BucketGrid({ percentage, highlight = null, disabled = false }: BucketGridProps) {
  return (
    <div
      className="bucket-grid"
      data-disabled={disabled || undefined}
      role="img"
      aria-label={
        `${percentage} of 100 buckets in rollout` +
        (highlight !== null ? `; user is in bucket ${highlight}` : '')
      }
    >
      {Array.from({ length: 100 }, (_, i) => (
        <span
          key={i}
          className="bucket"
          data-on={i < percentage || undefined}
          data-highlight={i === highlight || undefined}
        />
      ))}
    </div>
  );
}
