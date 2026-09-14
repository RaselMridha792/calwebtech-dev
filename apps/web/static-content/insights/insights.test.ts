import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  INSIGHTS_PAGE_SIZE,
  INSIGHTS_RELATED_LIMIT,
  INSIGHTS_TOC_MIN_WORDS,
  articleBodyProblems,
  articleLinkedSlugs,
  articleToc,
  articleWordCount,
  countSentences,
  homePageViewSchema,
  landingPageViewSchema,
  insightsArticleViewSchema,
  insightsIndexViewSchema,
  readingMinutes,
  type InsightsArticleView,
} from '@calwebtech/shared';
import { describe, expect, it } from 'vitest';
import home from '../home.json';
import landing from '../landing-b2b-website-design.json';
import servicesIndex from '../services/index.json';
import workIndex from '../work/index.json';
import { unfinishedCopy } from '../copy-rules';
import { insightsArticleSnapshots, insightsIndexSnapshot } from './index';

const FOLDER = import.meta.dirname;
const index = insightsIndexViewSchema.parse(insightsIndexSnapshot);
const articles = Object.entries(insightsArticleSnapshots).map(
  ([slug, snapshot]): [string, InsightsArticleView] => [slug, insightsArticleViewSchema.parse(snapshot)],
);
const approvedHome = homePageViewSchema.parse(home);
/** The approved demo team, from the client-approved landing page (docs/10-site-pages.md, Content). */
const approvedTeam = landingPageViewSchema.parse(landing).team;

describe('insights snapshots', () => {
  it('match the index contract, with publish-ready copy', () => {
    expect(unfinishedCopy(index)).toEqual([]);
    expect(index.articles.length).toBeGreaterThanOrEqual(6);
    expect(index.featuredSlug).not.toBeNull();
  });

  it('match the article contract, one file per slug, with publish-ready copy', () => {
    const files = readdirSync(FOLDER).filter((file) => file.endsWith('.json') && file !== 'index.json');
    expect(files.map((file) => path.basename(file, '.json')).sort()).toEqual(
      Object.keys(insightsArticleSnapshots).sort(),
    );

    for (const [slug, view] of articles) {
      expect(view.slug, `${slug}.json`).toBe(slug);
      expect(unfinishedCopy(view), `${slug}.json`).toEqual([]);
      const sentences = countSentences(view.answerBlock);
      expect(sentences, `${slug} answer block`).toBeGreaterThanOrEqual(2);
      expect(sentences, `${slug} answer block`).toBeLessThanOrEqual(3);
    }
  });

  it('are complete articles of 1,200 to 2,000 words, each with key takeaways', () => {
    for (const [slug, view] of articles) {
      expect(view.wordCount, slug).toBeGreaterThanOrEqual(1_200);
      expect(view.wordCount, slug).toBeLessThanOrEqual(2_000);
      expect(view.wordCount, slug).toBe(articleWordCount(view.body));
      expect(view.readingTime, slug).toBe(readingMinutes(view.wordCount));
      expect(view.takeaways.length, slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('carry a table of contents, because every article is past the minimum length', () => {
    for (const [slug, view] of articles) {
      expect(view.wordCount, slug).toBeGreaterThan(INSIGHTS_TOC_MIN_WORDS);
      const toc = articleToc(view);
      expect(toc.length, slug).toBeGreaterThan(2);
      expect(new Set(toc.map((heading) => heading.id)).size, `${slug} anchors are unique`).toBe(toc.length);
    }
  });

  it('write every body heading as a question, with no HTML and no second H1', () => {
    for (const [slug, view] of articles) {
      expect(articleBodyProblems(view.body), slug).toEqual([]);
    }
  });

  it('list every article once on the index, newest first, each with a page of its own', () => {
    expect(index.articles.map((card) => card.slug).sort()).toEqual(Object.keys(insightsArticleSnapshots).sort());
    const published = index.articles.map((card) => Date.parse(card.publishedAt));
    expect(published).toEqual([...published].sort((a, b) => b - a));
    // One page of results, so the index needs no pagination until a thirteenth article is published.
    expect(index.articles.length).toBeLessThanOrEqual(INSIGHTS_PAGE_SIZE + 1);
  });

  it('show the same card for an article wherever it appears', () => {
    const cards = new Map(index.articles.map((card) => [card.slug, card]));
    for (const [slug, view] of articles) {
      const card = cards.get(slug);
      expect(card, slug).toBeDefined();
      expect(card?.title).toBe(view.title);
      expect(card?.excerpt).toBe(view.excerpt);
      expect(card?.category).toEqual(view.category);
      expect(card?.authorName).toBe(view.author?.name ?? null);
      expect(card?.readingTime).toBe(view.readingTime);
      expect(card?.image).toEqual(view.cover);
      for (const related of view.relatedArticles) expect(related, `${slug} links ${related.slug}`).toEqual(cards.get(related.slug));
      expect(view.relatedArticles.map((related) => related.slug), slug).not.toContain(slug);
      expect(view.relatedArticles.length, slug).toBe(INSIGHTS_RELATED_LIMIT);
    }
  });

  it('count each topic correctly and give every topic with articles its own page copy', () => {
    for (const category of index.categories) {
      const held = index.articles.filter((card) => card.category?.slug === category.slug);
      expect(category.articleCount, category.slug).toBe(held.length);
      expect(category.articleCount, category.slug).toBeGreaterThan(0);
      expect(category.copy.listHeading, category.slug).toMatch(/\?$/);
      expect(unfinishedCopy(category.copy), category.slug).toEqual([]);
    }
    // A topic may never take an article's URL: one slug space serves both (docs/10-site-pages.md).
    const topics = new Set(index.categories.map((category) => category.slug));
    for (const slug of Object.keys(insightsArticleSnapshots)) expect(topics.has(slug), slug).toBe(false);
  });

  it('link only to services and case studies that are published, and derive the strip from the body', () => {
    const serviceSlugs = new Set(
      (servicesIndex as { groups: { services: { slug: string; title: string; summary: string }[] }[] }).groups.flatMap(
        (group) => group.services.map((service) => service.slug),
      ),
    );
    const services = new Map(
      (servicesIndex as { groups: { services: { slug: string; title: string; summary: string }[] }[] }).groups.flatMap(
        (group) => group.services.map((service) => [service.slug, service] as const),
      ),
    );
    const caseStudies = new Map(
      (workIndex as { caseStudies: { slug: string; clientName: string; metrics: unknown[] }[] }).caseStudies.map(
        (study) => [study.slug, study] as const,
      ),
    );

    for (const [slug, view] of articles) {
      const linked = articleLinkedSlugs(view.body, '/services/');
      expect(view.services.map((service) => service.slug), slug).toEqual(linked.slice(0, INSIGHTS_RELATED_LIMIT));
      expect(view.services.length, `${slug} offers a contextual service`).toBeGreaterThan(0);
      for (const service of view.services) {
        expect(serviceSlugs.has(service.slug), `${slug} links /services/${service.slug}/`).toBe(true);
        expect(service.title).toBe(services.get(service.slug)?.title);
        expect(service.summary).toBe(services.get(service.slug)?.summary);
      }

      const study = articleLinkedSlugs(view.body, '/work/')[0] ?? null;
      expect(view.caseStudy?.slug ?? null, slug).toBe(study);
      if (view.caseStudy) {
        const approved = caseStudies.get(view.caseStudy.slug);
        expect(approved, `${slug} links an approved case study`).toBeDefined();
        expect(view.caseStudy.clientName).toBe(approved?.clientName);
        // The approved figures only: an article never adds a number to a case study.
        expect(view.caseStudy.metrics).toEqual(approved?.metrics);
      }
    }
  });

  it('write every author from the approved team, and never invent credentials', () => {
    const team = new Map(approvedTeam.map((member) => [member.name, member] as const));
    for (const [slug, view] of articles) {
      expect(view.author, slug).not.toBeNull();
      const member = team.get(view.author?.name ?? '');
      expect(member, `${slug}: ${view.author?.name ?? 'nobody'} is on the approved team`).toBeDefined();
      expect(view.author?.role).toBe(member?.role);
      expect(view.author?.bio).toBe(member?.bio);
      expect(view.author?.photo).toEqual(member?.photo ?? null);
      expect(view.author?.credentials.length, slug).toBeGreaterThan(0);
    }
  });

  it('publish the three articles the approved homepage links, exactly as it describes them', () => {
    const cards = new Map(index.articles.map((card) => [card.slug, card]));
    expect(approvedHome.posts.length).toBeGreaterThan(0);
    for (const post of approvedHome.posts) {
      const card = cards.get(post.slug);
      expect(card, `the homepage links /insights/${post.slug}/`).toBeDefined();
      expect(card?.title).toBe(post.title);
      expect(card?.excerpt).toBe(post.excerpt);
      expect(card?.category?.name).toBe(post.category);
      expect(card?.readingTime).toBe(post.readingTime);
      expect(insightsArticleSnapshots[post.slug], `${post.slug}.json exists`).toBeDefined();
    }
  });

  it('keep every SEO title and description inside the limits, and unique across the family', () => {
    const seo = [index.copy.seo, ...index.categories.map((category) => category.copy.seo), ...articles.map(([, view]) => view.seo)];
    for (const entry of seo) {
      expect(entry.title.length, entry.title).toBeLessThanOrEqual(60);
      expect(entry.description.length, entry.title).toBeLessThanOrEqual(155);
    }
    expect(new Set(seo.map((entry) => entry.title)).size).toBe(seo.length);
    expect(new Set(seo.map((entry) => entry.description)).size).toBe(seo.length);
  });

  it('use only approved image hosts, with alt text on every image', () => {
    const images = [
      ...index.articles.flatMap((card) => (card.image ? [card.image] : [])),
      ...articles.flatMap(([, view]) => [
        ...(view.cover ? [view.cover] : []),
        ...(view.author?.photo ? [view.author.photo] : []),
        ...(view.caseStudy?.image ? [view.caseStudy.image] : []),
      ]),
    ];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.src, image.alt).toMatch(/^https:\/\/images\.(unsplash|pexels)\.com\//);
      expect(image.alt.trim().length, image.src).toBeGreaterThan(0);
    }
    expect(index.copy.backdrop?.src).toMatch(/^https:\/\/images\.(unsplash|pexels)\.com\//);
  });

  it('link out only over https, and only inside the site with a trailing slash', () => {
    const LINK = /\]\((?<href>[^)\s]+)\)/g;
    for (const [slug, view] of articles) {
      for (const match of view.body.matchAll(LINK)) {
        const href = match.groups?.href ?? '';
        if (href.startsWith('/')) {
          expect(href, `${slug} links ${href}`).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/);
        } else {
          expect(href, `${slug} links ${href}`).toMatch(/^https:\/\//);
        }
      }
    }
  });
});
