import { describe, expect, it } from 'vitest';
import { calibrationBenchmark, cpuMultiplierFor, isHealthyRun, median, REFERENCE_BENCHMARK } from './calibrate.mjs';

describe('cpuMultiplierFor', () => {
  it('is 4x on the reference host', () => {
    expect(cpuMultiplierFor(REFERENCE_BENCHMARK)).toBe(4);
  });

  it('slows a slower host less, so the simulated device stays the same', () => {
    expect(cpuMultiplierFor(2079)).toBeCloseTo(3.47, 2);
    expect(cpuMultiplierFor(1270)).toBeCloseTo(2.12, 2);
    expect(cpuMultiplierFor(2958)).toBeCloseTo(4.93, 2);
  });

  it('clamps to a sane range', () => {
    expect(cpuMultiplierFor(100)).toBe(1);
    expect(cpuMultiplierFor(10_000)).toBe(8);
  });

  it('rejects a missing benchmark', () => {
    expect(() => cpuMultiplierFor(Number.NaN)).toThrow();
  });
});

describe('calibrationBenchmark', () => {
  it('takes the fastest run, because contention only slows a run down', () => {
    expect(calibrationBenchmark([2346, 2416, 1092])).toBe(2416);
  });

  it('ignores missing values and rejects an empty calibration', () => {
    expect(calibrationBenchmark([Number.NaN, 2100])).toBe(2100);
    expect(() => calibrationBenchmark([])).toThrow();
  });
});

describe('isHealthyRun', () => {
  it('discards a run on a contended host, where the simulation is too strict', () => {
    expect(isHealthyRun(2431, 2430)).toBe(true);
    expect(isHealthyRun(2079, 2430)).toBe(false);
    expect(isHealthyRun(1071, 2381)).toBe(false);
  });

  it('discards a run far faster than calibration, where the simulation would be too lenient', () => {
    expect(isHealthyRun(2530, 2381)).toBe(true);
    expect(isHealthyRun(2400, 1500)).toBe(false);
  });
});

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
