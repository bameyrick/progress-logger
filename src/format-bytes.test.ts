import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes.js';

describe('formatBytes', () => {
  describe('bytes', () => {
    it('returns 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 bytes');
    });

    it('returns raw byte count for small values', () => {
      expect(formatBytes(500)).toBe('500 bytes');
      expect(formatBytes(999)).toBe('999 bytes');
    });

    it('stays as bytes at exactly 1000 (threshold is > 1 KB, not >= 1 KB)', () => {
      expect(formatBytes(1000)).toBe('1000 bytes');
    });
  });

  describe('KB', () => {
    it('formats 1.5 KB with leading padding', () => {
      expect(formatBytes(1500)).toBe('  1.5 KB');
    });

    it('formats 10 KB with one space of padding', () => {
      expect(formatBytes(10_000)).toBe(' 10.0 KB');
    });

    it('formats 100 KB with no padding', () => {
      expect(formatBytes(100_000)).toBe('100.0 KB');
    });

    it('pads decimal to one place for whole numbers', () => {
      expect(formatBytes(2000)).toBe('  2.0 KB');
    });
  });

  describe('MB', () => {
    it('formats 1.5 MB with leading padding', () => {
      expect(formatBytes(1_500_000)).toBe('  1.5 MB');
    });

    it('formats 10 MB with one space of padding', () => {
      expect(formatBytes(10_000_000)).toBe(' 10.0 MB');
    });

    it('formats 100 MB with no padding', () => {
      expect(formatBytes(100_000_000)).toBe('100.0 MB');
    });
  });

  describe('GB', () => {
    it('formats 1.5 GB with two decimal places and leading padding', () => {
      expect(formatBytes(1_500_000_000)).toBe('  1.50 GB');
    });

    it('formats 10 GB with one space of padding', () => {
      expect(formatBytes(10_000_000_000)).toBe(' 10.00 GB');
    });

    it('formats 100 GB with no padding', () => {
      expect(formatBytes(100_000_000_000)).toBe('100.00 GB');
    });

    it('pads decimal to two places for whole numbers', () => {
      expect(formatBytes(2_000_000_000)).toBe('  2.00 GB');
    });
  });
});
