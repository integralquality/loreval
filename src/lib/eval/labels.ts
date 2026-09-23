/**
 * Row labels shared between the statistics table and the charts.
 *
 * These live outside the components because the two views drifted apart once
 * already: the cost chart printed cost-per-solve beside a bar whose length
 * was total spend, so the figure next to the bar disagreed with the same
 * model's row in the table. One function, tested, keeps them honest.
 */
import { formatCost } from './pricing';
import type { ModelStats } from './stats';

/**
 * Spend for a model, with cost per solve in brackets.
 *
 * The primary figure is total spend, because that is what the bar's length
 * encodes and what the table's Cost column shows. Per solve is the number
 * worth comparing — a model that fails cheaply looks good on spend alone —
 * so it rides along in brackets, and is omitted when nothing solved, where
 * it would be a division by zero rather than a zero.
 */
export function costLabel(row: Pick<ModelStats, 'costUsd' | 'costPerSolve' | 'solved'>): string {
  if (row.costUsd === null) return '—';
  const spend = formatCost(row.costUsd);
  if (row.costPerSolve === null || row.solved === 0) return spend;
  return `${spend} (${formatCost(row.costPerSolve)})`;
}
