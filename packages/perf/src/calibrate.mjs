// CPU throttling calibrated to the host.
//
// Lighthouse's simulated throttling multiplies the CPU time it observes on the host by
// cpuSlowdownMultiplier. A fixed 4x therefore lets host speed leak into TBT and LCP:
// the same build scored TBT 104ms in a run with benchmark index 2431 and 268ms in a
// run at 2079, in the same CI job. Scaling the multiplier with the benchmark index
// keeps the simulated device constant. Lighthouse's own guidance is to pick the
// multiplier from the benchmark index (docs/throttling.md in the Lighthouse repo);
// this applies it continuously instead of by device bracket.

/** A typical GitHub-hosted ubuntu-latest runner. On this host the multiplier is 4x. */
export const REFERENCE_BENCHMARK = 2400;
/** Lighthouse's default: a high-end desktop slowed to a mid-tier phone. */
export const REFERENCE_MULTIPLIER = 4;

/**
 * A run is kept only while its benchmark index stays within this share of calibration.
 * Below the band the host was contended and the simulation is too strict: the run that
 * scored TBT 268ms sat at 0.855 of calibration. Above it, calibration itself ran on a
 * contended host, the multiplier came out too low, and the simulation would be too
 * lenient. Benchmark jitter within one CI job was about ±3%.
 */
export const HEALTHY_BAND = { min: 0.9, max: 1.1 };

/**
 * The host's uncontended speed: the fastest calibration run. Contention only ever slows
 * a run down, so the fastest sample is the closest to the real host.
 * @param {number[]} benchmarks
 */
export function calibrationBenchmark(benchmarks) {
  const valid = benchmarks.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) throw new Error('No valid calibration benchmark');
  return Math.max(...valid);
}

/** @param {number} benchmarkIndex */
export function cpuMultiplierFor(benchmarkIndex) {
  if (!Number.isFinite(benchmarkIndex) || benchmarkIndex <= 0) {
    throw new Error(`Invalid benchmark index: ${benchmarkIndex}`);
  }
  const scaled = REFERENCE_MULTIPLIER * (benchmarkIndex / REFERENCE_BENCHMARK);
  return Math.round(Math.min(8, Math.max(1, scaled)) * 100) / 100;
}

/**
 * @param {number} runBenchmark benchmark index measured during the run
 * @param {number} calibratedBenchmark benchmark index the multiplier was derived from
 */
export function isHealthyRun(runBenchmark, calibratedBenchmark) {
  const ratio = runBenchmark / calibratedBenchmark;
  return ratio >= HEALTHY_BAND.min && ratio <= HEALTHY_BAND.max;
}

/** @param {number[]} values */
export function median(values) {
  if (values.length === 0) throw new Error('median of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
