import { Decimal, tryToDecimal } from '@/lib/finance';
import { formatINR, formatNav, formatUnits } from '@/lib/format';
import type { ActivityKind, ClientActivity, ClientCycle } from './api';

export interface ClientPosition {
  /** Capital of the lots valued at the latest NAV. */
  contributed: Decimal | null;
  netValue: Decimal | null;
  pnl: Decimal | null;
  pnlReturn: Decimal | null;
  /** The client's own net value per unit (net value ÷ valued units). */
  netNavPerUnit: Decimal | null;
  /** True when some verified money has not yet been valued by a published NAV. */
  hasUnvaluedLots: boolean;
}

/** P/L compares the same lots at the same as-of time (server figures; display-only maths). */
export function clientPosition(c: ClientCycle, valuedUnits: Decimal | null): ClientPosition {
  const contributed = tryToDecimal(c.lots_contributed ?? '');
  const netValue = tryToDecimal(c.net_value ?? '');
  const pnl = contributed && netValue ? netValue.minus(contributed) : null;
  const total = tryToDecimal(c.net_contributed) ?? new Decimal(0);
  return {
    contributed,
    netValue,
    pnl,
    pnlReturn:
      pnl && contributed && !contributed.isZero() ? pnl.dividedBy(contributed).toDecimalPlaces(6) : null,
    netNavPerUnit:
      netValue && valuedUnits && valuedUnits.greaterThan(0)
        ? netValue.dividedBy(valuedUnits).toDecimalPlaces(8)
        : null,
    hasUnvaluedLots: !contributed ? total.greaterThan(0) : !total.equals(contributed),
  };
}

const KIND_TEXT: Record<ActivityKind, string> = {
  contribution_recorded: 'Contribution received — awaiting verification',
  units_issued: 'Contribution verified — units issued',
  contribution_rejected: 'Contribution not accepted',
  contribution_reversed: 'Contribution reversed — units removed',
  nav_published: 'NAV published',
};

export function describeClientActivity(a: ClientActivity): string {
  const base = KIND_TEXT[a.kind] ?? a.kind;
  switch (a.kind) {
    case 'contribution_recorded':
    case 'contribution_rejected':
      return `${base}: ${formatINR(a.amount)}`;
    case 'units_issued':
      return `${base}: ${formatINR(a.amount)} → ${formatUnits(a.units)} units at ${formatNav(a.nav)}`;
    case 'contribution_reversed':
      return `${base}: ${formatUnits(a.units)} units`;
    case 'nav_published':
      return `${base}: ${formatNav(a.nav)} per unit (gross)`;
    default:
      return base;
  }
}

// ------------------------------------------------------------------------------------------------
// CSV export
// ------------------------------------------------------------------------------------------------

/**
 * RFC 4180 CSV with spreadsheet-formula neutralisation: cells starting with = + - @ (or tab/CR)
 * are prefixed with an apostrophe so they cannot execute as formulas when opened in Excel.
 * Plain negative numbers are left as numbers.
 */
export function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const cell = (v: string | null | undefined) => {
    let s = v ?? '';
    if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 (₹) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
