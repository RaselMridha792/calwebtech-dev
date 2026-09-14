import b2bEcommerceWhatAStockThemeCannotDo from './b2b-ecommerce-what-a-stock-theme-cannot-do.json';
import coreWebVitalsInPlainEnglish from './core-web-vitals-in-plain-english.json';
import howToWriteAWebsiteBrief from './how-to-write-a-website-brief.json';
import index from './index.json';
import selfHostingIsCheaperThanYouThink from './self-hosting-is-cheaper-than-you-think.json';
import thePageBuilderTax from './the-page-builder-tax.json';
import wcag22WhatChanged from './wcag-22-what-changed.json';
import websiteRedesignCost2026 from './website-redesign-cost-2026.json';
import whyChatgptRecommendsYourCompetitor from './why-chatgpt-recommends-your-competitor.json';

/**
 * The insights family's views exactly as the API returns them, for rendering with no API
 * (docs/10-site-pages.md). The articles are the publish-ready copy; the database seed stays
 * placeholder-only. The pages validate these with the same schemas as a live response.
 */
export const insightsIndexSnapshot: unknown = index;

/** Article views keyed by slug. Topic pages are built from the index view's `categories`. */
export const insightsArticleSnapshots: Readonly<Record<string, unknown>> = {
  'why-chatgpt-recommends-your-competitor': whyChatgptRecommendsYourCompetitor,
  'website-redesign-cost-2026': websiteRedesignCost2026,
  'b2b-ecommerce-what-a-stock-theme-cannot-do': b2bEcommerceWhatAStockThemeCannotDo,
  'core-web-vitals-in-plain-english': coreWebVitalsInPlainEnglish,
  'self-hosting-is-cheaper-than-you-think': selfHostingIsCheaperThanYouThink,
  'the-page-builder-tax': thePageBuilderTax,
  'wcag-22-what-changed': wcag22WhatChanged,
  'how-to-write-a-website-brief': howToWriteAWebsiteBrief,
};
