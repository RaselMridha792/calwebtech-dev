import { answerBlockSchema, workCopySchema } from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import { PAGE_FIXTURES, PAGE_SEEDS } from './index';
import { WORK_PLACEHOLDER_COPY, workFixtures, workSeed } from './work';

describe('work page seed', () => {
  it('writes copy that matches the contract and reads as a placeholder', () => {
    const copy = workCopySchema.parse(WORK_PLACEHOLDER_COPY);
    expect(copy.index.title).toMatch(/^Placeholder/);
    expect(copy.index.targets).toEqual([]);
    expect(copy.caseStudy.measurement).toMatch(/^Placeholder/);
  });

  it('is registered as a launch seed and as an end-to-end fixture', async () => {
    const seeds = await Promise.all(PAGE_SEEDS.map((load) => load()));
    const fixtures = await Promise.all(PAGE_FIXTURES.map((load) => load()));
    expect(seeds).toContain(workSeed);
    expect(fixtures).toContain(workFixtures);
  });

  it('gives the fixture case study what its page needs: an answer block and three figures', () => {
    const project = workFixtures.content as { answerBlock: string; outcomeMetrics: unknown[]; featured: boolean };
    expect(answerBlockSchema.safeParse(project.answerBlock).success).toBe(true);
    expect(project.outcomeMetrics).toHaveLength(3);
    expect(project.featured).toBe(false);
  });
});
