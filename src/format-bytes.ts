const KB = 1000;
const MB = Math.pow(1000, 2);
const GB = Math.pow(1000, 3);

export function formatBytes(bytes: number): string {
  const gb = +(bytes / GB).toFixed(2);

  if (gb > 1) {
    return `${forceDecimals(gb, 2, 4)} GB`;
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

function forceDecimals(value: number, precission: number, totalLength = 5): string {
  const parts = value.toString().split('.');

  if (parts[1]) {
    parts[1] = parts[1].padEnd(precission, '0');
  } else {
    parts[1] = ''.padEnd(precission, '0');
  }

  return parts.join('.').padStart(totalLength, ' ');
}
