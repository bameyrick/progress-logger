const KB = 1000;
const MB = 1_000_000;
const GB = 1_000_000_000;

export function formatBytes(bytes: number): string {
  const gb = +(bytes / GB).toFixed(2);

  if (gb > 1) {
    return `${forceDecimals(gb, 2, 6)} GB`;
  }

  const mb = +(bytes / MB).toFixed(1);

  if (mb > 1) {
    return `${forceDecimals(mb, 1)} MB`;
  }

  const kb = +(bytes / KB).toFixed(1);

  if (kb > 1) {
    return `${forceDecimals(kb, 1)} KB`;
  }

  return `${bytes} bytes`;
}

function forceDecimals(value: number, precision: number, totalLength = 5): string {
  const parts = value.toString().split('.');

  if (parts[1]) {
    parts[1] = parts[1].substring(0, precision).padEnd(precision, '0');
  } else {
    parts[1] = ''.padEnd(precision, '0');
  }

  return parts.join('.').padStart(totalLength, ' ');
}
