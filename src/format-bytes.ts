const KB = 1000;
const MB = Math.pow(1000, 2);
const GB = Math.pow(1000, 3);

export function formatBytes(bytes: number): string {
  const gb = +(bytes / GB).toFixed(2);

  if (gb > 1) {
    return `${gb} GB`;
  }

  const mb = +(bytes / MB).toFixed(1);

  if (mb > 1) {
    return `${mb} MB`;
  }

  const kb = +(mb / KB).toFixed(1);

  if (kb > 1) {
    return `${kb} KB`;
  }

  return `${bytes} bytes`;
}
