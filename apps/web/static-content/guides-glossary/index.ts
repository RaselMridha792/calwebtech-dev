import termN301Redirect from './glossary/301-redirect.json';
import termAbTesting from './glossary/ab-testing.json';
import termAccessibilityWcag from './glossary/accessibility-wcag.json';
import termAnswerEngineOptimisation from './glossary/answer-engine-optimisation.json';
import termApi from './glossary/api.json';
import termBackupAndRestore from './glossary/backup-and-restore.json';
import termBounceRate from './glossary/bounce-rate.json';
import termCanonicalTag from './glossary/canonical-tag.json';
import termContentDeliveryNetwork from './glossary/content-delivery-network.json';
import termContentManagementSystem from './glossary/content-management-system.json';
import termConversionRateOptimisation from './glossary/conversion-rate-optimisation.json';
import termCoreWebVitals from './glossary/core-web-vitals.json';
import termDesignSystem from './glossary/design-system.json';
import termDns from './glossary/dns.json';
import termHeadlessCms from './glossary/headless-cms.json';
import termHeadlessCommerce from './glossary/headless-commerce.json';
import glossaryIndex from './glossary/index.json';
import termInformationArchitecture from './glossary/information-architecture.json';
import termLargeLanguageModel from './glossary/large-language-model.json';
import termLiquid from './glossary/liquid.json';
import termLlmsTxt from './glossary/llms-txt.json';
import termPageBuilder from './glossary/page-builder.json';
import termPaymentGateway from './glossary/payment-gateway.json';
import termPlugin from './glossary/plugin.json';
import termProductCatalogue from './glossary/product-catalogue.json';
import termPunchoutCatalogue from './glossary/punchout-catalogue.json';
import termReplatforming from './glossary/replatforming.json';
import termResponsiveDesign from './glossary/responsive-design.json';
import termRetrievalAugmentedGeneration from './glossary/retrieval-augmented-generation.json';
import termServerSideRendering from './glossary/server-side-rendering.json';
import termStagingEnvironment from './glossary/staging-environment.json';
import termStaticSiteGeneration from './glossary/static-site-generation.json';
import termStructuredData from './glossary/structured-data.json';
import termTlsCertificate from './glossary/tls-certificate.json';
import termUptimeMonitoring from './glossary/uptime-monitoring.json';
import termVectorEmbedding from './glossary/vector-embedding.json';
import termWebApplication from './glossary/web-application.json';
import termWireframe from './glossary/wireframe.json';
import guideB2bWebsitePlanningGuide from './guides/b2b-website-planning-guide.json';
import guideCoreWebVitalsGuide from './guides/core-web-vitals-guide.json';
import guidesIndex from './guides/index.json';

/**
 * The guides and glossary family's views while no API is hosted (docs/10-site-pages.md,
 * Snapshots): exactly what `GET /pages/guides`, `GET /pages/guides/:slug`,
 * `GET /pages/glossary` and `GET /pages/glossary/:slug` return, with the publish-ready
 * copy. Validated by the getters and by guides-glossary.test.ts.
 */
export const guidesIndexSnapshot: unknown = guidesIndex;
export const glossaryIndexSnapshot: unknown = glossaryIndex;

/** Guide views keyed by slug. */
export const guideSnapshots: Readonly<Record<string, unknown>> = {
  'b2b-website-planning-guide': guideB2bWebsitePlanningGuide,
  'core-web-vitals-guide': guideCoreWebVitalsGuide,
};

/** Glossary term views keyed by slug. */
export const glossaryTermSnapshots: Readonly<Record<string, unknown>> = {
  'ab-testing': termAbTesting,
  'accessibility-wcag': termAccessibilityWcag,
  'answer-engine-optimisation': termAnswerEngineOptimisation,
  'api': termApi,
  'backup-and-restore': termBackupAndRestore,
  'bounce-rate': termBounceRate,
  'canonical-tag': termCanonicalTag,
  'content-delivery-network': termContentDeliveryNetwork,
  'content-management-system': termContentManagementSystem,
  'conversion-rate-optimisation': termConversionRateOptimisation,
  'core-web-vitals': termCoreWebVitals,
  'design-system': termDesignSystem,
  'dns': termDns,
  'headless-cms': termHeadlessCms,
  'headless-commerce': termHeadlessCommerce,
  'information-architecture': termInformationArchitecture,
  'large-language-model': termLargeLanguageModel,
  'liquid': termLiquid,
  'llms-txt': termLlmsTxt,
  'page-builder': termPageBuilder,
  'payment-gateway': termPaymentGateway,
  'plugin': termPlugin,
  'product-catalogue': termProductCatalogue,
  'punchout-catalogue': termPunchoutCatalogue,
  'replatforming': termReplatforming,
  'responsive-design': termResponsiveDesign,
  'retrieval-augmented-generation': termRetrievalAugmentedGeneration,
  'server-side-rendering': termServerSideRendering,
  'staging-environment': termStagingEnvironment,
  'static-site-generation': termStaticSiteGeneration,
  'structured-data': termStructuredData,
  'tls-certificate': termTlsCertificate,
  'uptime-monitoring': termUptimeMonitoring,
  'vector-embedding': termVectorEmbedding,
  'web-application': termWebApplication,
  'wireframe': termWireframe,
  '301-redirect': termN301Redirect,
};

/**
 * A snapshot, or undefined for any other path segment. Own keys only, so a slug such as
 * `constructor` or `__proto__` is a 404 rather than an object from the prototype.
 */
export function guideSnapshot(slug: string): unknown {
  return Object.hasOwn(guideSnapshots, slug) ? guideSnapshots[slug] : undefined;
}

export function glossaryTermSnapshot(slug: string): unknown {
  return Object.hasOwn(glossaryTermSnapshots, slug) ? glossaryTermSnapshots[slug] : undefined;
}
