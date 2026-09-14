import { describe, expect, it } from 'vitest';
import { ViewCache } from './view-cache';

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe('ViewCache', () => {
  it('shares one build between concurrent requests for a key', async () => {
    const cache = new ViewCache<string>(1000);
    let builds = 0;
    const build = () => {
      builds += 1;
      return Promise.resolve('view');
    };
    const [first, second] = await Promise.all([cache.get('a', build), cache.get('a', build)]);
    expect([first, second]).toEqual(['view', 'view']);
    expect(builds).toBe(1);
  });

  it('builds again once the entry expires', async () => {
    const time = clock();
    const cache = new ViewCache<number>(1000, 500, time.now);
    let builds = 0;
    const build = () => Promise.resolve((builds += 1));
    expect(await cache.get('a', build)).toBe(1);
    time.advance(999);
    expect(await cache.get('a', build)).toBe(1);
    time.advance(1);
    expect(await cache.get('a', build)).toBe(2);
  });

  it('does not keep a failed build', async () => {
    const cache = new ViewCache<string>(1000);
    await expect(cache.get('a', () => Promise.reject(new Error('database down')))).rejects.toThrow('database down');
    expect(await cache.get('a', () => Promise.resolve('recovered'))).toBe('recovered');
  });

  it('caches keys independently, including a null view for a missing record', async () => {
    const cache = new ViewCache<string | null>(1000);
    let builds = 0;
    const missing = () => {
      builds += 1;
      return Promise.resolve(null);
    };
    expect(await cache.get('missing', missing)).toBeNull();
    expect(await cache.get('missing', missing)).toBeNull();
    expect(await cache.get('present', () => Promise.resolve('page'))).toBe('page');
    expect(builds).toBe(1);
  });

  it('evicts the oldest keys beyond its bound', async () => {
    const cache = new ViewCache<string>(1000, 2);
    let builds = 0;
    const build = (value: string) => () => {
      builds += 1;
      return Promise.resolve(value);
    };
    await cache.get('a', build('a'));
    await cache.get('b', build('b'));
    await cache.get('c', build('c'));
    expect(builds).toBe(3);
    await cache.get('c', build('c'));
    await cache.get('b', build('b'));
    expect(builds).toBe(3);
    await cache.get('a', build('a'));
    expect(builds).toBe(4);
  });
});
