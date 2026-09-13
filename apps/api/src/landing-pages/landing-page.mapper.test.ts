import { Prisma, type ReviewSource } from '@calwebtech/db';
import { describe, expect, it } from 'vitest';
import { summariseReviews } from './landing-page.mapper';

function source(platform: string, rating: number, reviewCount: number): ReviewSource {
  return {
    id: platform,
    platform,
    rating: new Prisma.Decimal(rating),
    reviewCount,
    profileUrl: null,
    refreshedAt: new Date('2026-09-01T00:00:00Z'),
  };
}

describe('summariseReviews', () => {
  it('weights the average by review count and sorts by volume', () => {
    const summary = summariseReviews(
      [source('DesignRush', 5, 34), source('Google', 4.9, 96), source('Clutch', 4.9, 71)],
      9.6,
    );
    expect(summary.totalReviews).toBe(201);
    expect(summary.averageRating).toBe(4.9);
    expect(summary.sources.map((s) => s.platform)).toEqual(['Google', 'Clutch', 'DesignRush']);
    expect(summary.npsScore).toBe(9.6);
  });

  it('returns no average when there are no reviews', () => {
    expect(summariseReviews([], null)).toEqual({
      averageRating: null,
      totalReviews: 0,
      sources: [],
      npsScore: null,
    });
  });
});
