import type { HomePageContentInput, LandingPageContentInput } from '@calwebtech/shared';

/**
 * Placeholder content for environments someone can open. Staging runs the launch seed
 * on every deploy, so everything here must be safe on a reachable URL:
 *
 * - no real company, publication or person names;
 * - no invented metrics, prices, ratings, review counts, awards or client claims;
 * - no commitments the client has not approved, such as reply times or warranties.
 *
 * Copy that would otherwise assert something about the business says "Placeholder".
 * Sections with no safe placeholder (case studies, testimonials, reviews, client logos,
 * partners, team, before and after) get no records and render their empty state.
 * content.test.ts scans this file for the proof the reference mockups invented.
 */

/** A 555-01xx number is reserved for fiction; example.com is reserved for documentation. */
export const PLACEHOLDER_CONTACT = {
  phone: '+1 (555) 010-0100',
  phoneE164: '+15550100100',
  email: 'hello@example.com',
};

export const PLACEHOLDER_PROOF = { npsScore: null, npsProjectCount: null };

export const LANDING_SLUG = 'b2b-website-design';

export const LANDING_SEO = {
  title: 'Placeholder: B2B website campaign | Calwebtech',
  description: 'Placeholder description for the B2B website campaign landing page.',
};

const requestLabel = 'Request a proposal';

export const LANDING_CONTENT: LandingPageContentInput = {
  header: { ctaLabel: requestLabel },
  hero: {
    badge: 'Placeholder campaign badge',
    heading: 'Placeholder headline for the B2B website campaign',
    intro:
      'Placeholder introduction. The approved campaign copy replaces this text before the page is published.',
    bullets: ['Placeholder benefit one', 'Placeholder benefit two', 'Placeholder benefit three'],
    stats: [],
    // Stock footage (Pexels licence) until it is moved to our own media storage. The poster
    // is its first frame, so the fade from poster to video is seamless.
    backgroundImage: { src: '/media/landing-hero-poster.jpg' },
    backgroundVideoUrl: 'https://videos.pexels.com/video-files/8523640/8523640-hd_1280_720_25fps.mp4',
  },
  heroForm: {
    heading: requestLabel,
    subheading: 'Placeholder form subheading.',
    submitLabel: 'Send my request',
    assurances: [],
  },
  formSuccess: {
    heading: 'Thanks. Your request is with us.',
    body: 'We will reply to you by email.',
  },
  trustBar: { label: 'Placeholder client list label' },
  problem: {
    heading: 'Placeholder problem statement',
    intro: 'Placeholder. The approved copy describes the problem this campaign speaks to.',
    cards: [],
  },
  solution: {
    heading: 'Placeholder approach heading',
    steps: [
      { title: 'Placeholder point one', body: 'Placeholder description of the first part of the approach.' },
      { title: 'Placeholder point two', body: 'Placeholder description of the second part of the approach.' },
      { title: 'Placeholder point three', body: 'Placeholder description of the third part of the approach.' },
    ],
    image: null,
  },
  services: {
    heading: 'Placeholder services heading',
    intro: 'Placeholder. The approved copy introduces the services this campaign covers.',
    items: [
      { title: 'Website design and build', body: 'Placeholder description of this service.' },
      { title: 'Ecommerce', body: 'Placeholder description of this service.' },
      { title: 'Integrations', body: 'Placeholder description of this service.' },
      { title: 'Search visibility', body: 'Placeholder description of this service.' },
      { title: 'Site speed', body: 'Placeholder description of this service.' },
      { title: 'Care and hosting', body: 'Placeholder description of this service.' },
    ],
  },
  results: {
    heading: 'Placeholder case studies heading',
    intro: 'Placeholder. Published case studies appear here.',
    ctaLabel: requestLabel,
  },
  process: {
    badge: 'Placeholder timeline',
    heading: 'Placeholder process heading',
    intro: 'Placeholder. The approved copy introduces how a project runs.',
    backgroundImage: null,
  },
  beforeAfter: {
    heading: 'Placeholder comparison heading',
    intro: 'Placeholder. A published before and after comparison appears here.',
    ctaLabel: requestLabel,
  },
  partners: {
    heading: 'Placeholder partners heading',
    intro: 'Placeholder. Confirmed partnerships appear here.',
    technologiesLabel: 'Placeholder label',
  },
  team: {
    heading: 'Placeholder team heading',
    intro: 'Placeholder. People appear here once they approve their profiles.',
  },
  testimonials: { heading: 'Placeholder client quotes heading', backgroundImage: null },
  guarantees: { heading: 'Placeholder commitments heading', items: [] },
  pricing: {
    heading: 'Placeholder pricing heading',
    intro: 'Placeholder. The approved pricing copy replaces this text.',
    ctaLabel: requestLabel,
    backgroundImage: null,
  },
  faq: {
    heading: 'Placeholder questions heading',
    intro: 'Placeholder. The approved questions and answers replace these.',
    callLabel: 'Call us',
  },
  finalCta: {
    heading: 'Tell us about your project',
    intro: 'Placeholder introduction for the final form.',
    points: [],
    backgroundImage: null,
    submitLabel: 'Send my request',
    serviceOptions: ['New website', 'Redesign', 'Ecommerce', 'Integration', 'Search visibility', 'Care plan'],
    formFootnote: 'Placeholder form footnote.',
  },
};

const ordinal = ['one', 'two', 'three', 'four'] as const;

export const LANDING_FAQS = ordinal.map((word) => ({
  question: `Placeholder question ${word}?`,
  answer: 'Placeholder answer. The approved answer is written with the client before this page is published.',
}));

/** Generic stage names; everything that would describe how the business works is a placeholder. */
export const PROCESS_STEPS = ['Discovery', 'Design', 'Build', 'Testing', 'Launch'].map((title) => ({
  title,
  timing: 'Timing to confirm',
  summary: `Placeholder summary of the ${title.toLowerCase()} stage.`,
  heading: `Placeholder heading for ${title.toLowerCase()}`,
  body: 'Placeholder. The approved description of this stage, what happens and who is involved, replaces this text before launch.',
  youGet: ['Placeholder deliverable one', 'Placeholder deliverable two'],
  weNeed: ['Placeholder input from the client'],
}));

export const PRICING_TIERS = ordinal.slice(0, 3).map((word, index) => ({
  name: `Placeholder tier ${word}`,
  priceLabel: 'Price to confirm',
  summary: 'Placeholder. Scope and price are set with the client before launch.',
  highlighted: index === 1,
}));

// ---------------------------------------------------------------- homepage

const six = ['one', 'two', 'three', 'four', 'five', 'six'] as const;

export const HOME_CONTENT: HomePageContentInput = {
  seo: {
    title: 'Placeholder: Calwebtech homepage',
    description: 'Placeholder description for the Calwebtech homepage. The approved copy replaces it before launch.',
  },
  utilityBar: { serviceArea: 'Placeholder service area' },
  header: {
    primaryCta: { label: 'Book a consultation', href: '/book-a-consultation/' },
    secondaryCta: { label: 'Instant estimate', href: '#estimate' },
  },
  megaMenu: {
    servicesPromo: {
      heading: 'Placeholder estimate promo',
      body: 'Placeholder. The approved copy introduces the cost estimate.',
      cta: { label: 'Get an instant estimate', href: '#estimate' },
    },
  },
  hero: {
    eyebrow: 'Placeholder eyebrow',
    heading: 'Placeholder homepage headline, closing with',
    headingEmphasis: 'an emphasised phrase.',
    intro:
      'Placeholder introduction. The approved homepage copy replaces this text before the site is published.',
    primaryCta: { label: 'See our work', href: '#work' },
    secondaryCta: { label: 'Or get an instant estimate', href: '#estimate' },
    form: {
      heading: 'Request a quote',
      subheading: 'Placeholder form subheading.',
      submitLabel: 'Send my request',
      footnote: null,
    },
    background: { poster: null, videoUrl: null },
  },
  formSuccess: { heading: 'Thanks. Your request is with us.', body: 'We will reply to you by email.' },
  clients: { label: 'Placeholder client list label' },
  capability: {
    heading: 'Placeholder capability heading',
    bullets: ['Placeholder capability one', 'Placeholder capability two', 'Placeholder capability three'],
    body: 'Placeholder. The approved copy describes how the team works with clients.',
    primaryCta: { label: 'See our work', href: '#work' },
    showreel: null,
    background: { poster: null, videoUrl: null },
  },
  problemRouter: {
    heading: 'Placeholder problem router heading',
    intro: 'Placeholder. The approved copy invites visitors to pick the problem closest to theirs.',
    cta: { label: 'Talk it through with us', href: '/book-a-consultation/' },
  },
  services: { heading: 'Placeholder services heading' },
  work: {
    heading: 'Placeholder case studies heading',
    intro: 'Placeholder. Published case studies appear here.',
    empty: 'No case studies are published yet.',
  },
  midCta: {
    eyebrow: 'Placeholder band eyebrow',
    heading: 'Placeholder call to action',
    primaryCta: { label: 'Request a quote', href: '#quote' },
    secondaryCta: { label: 'Get an instant estimate', href: '#estimate' },
  },
  beforeAfter: {
    heading: 'Placeholder comparison heading',
    intro: 'Placeholder. A published before and after comparison appears here.',
    empty: 'No before and after comparison is published yet.',
  },
  industries: {
    heading: 'Placeholder industries heading',
    intro: 'Placeholder. The approved copy introduces the industries served.',
    notListed: {
      heading: 'Not listed here?',
      body: 'Placeholder. The approved copy invites other industries to get in touch.',
      cta: { label: 'Start the conversation', href: '/book-a-consultation/' },
    },
  },
  estimate: {
    badge: 'Placeholder estimate badge',
    heading: 'Placeholder estimate heading',
    intro: 'Placeholder. The approved copy explains the cost estimate.',
    bullets: [],
    preview: {
      progressLabel: 'Question preview',
      question: 'How many pages will the new site need?',
      options: ['Under 10', '10 to 50', '50 to 150', 'More than 150'],
    },
    cta: { label: 'Talk to us about cost', href: '/book-a-consultation/' },
  },
  whyUs: {
    heading: 'Placeholder reasons heading',
    items: six.map((word) => ({
      title: `Placeholder reason ${word}`,
      body: 'Placeholder. The approved copy states a reason the client can back up.',
    })),
  },
  technology: {
    heading: 'Placeholder technology heading',
    intro: 'Placeholder. The approved copy introduces the technology behind client projects.',
    empty: 'No technology details are published yet.',
  },
  process: {
    heading: 'Placeholder process heading',
    intro: 'Placeholder. The approved copy introduces how a project runs.',
  },
  testimonials: { heading: 'Placeholder client quotes heading', empty: 'No client quotes are published yet.' },
  recognition: {
    eyebrow: 'Placeholder recognition eyebrow',
    heading: 'Placeholder recognition heading',
    empty: 'Nothing is published here yet.',
  },
  insights: { heading: 'Placeholder insights heading', empty: 'No articles are published yet.' },
  whitepaper: { eyebrow: 'Placeholder guide eyebrow', ctaLabel: 'Download the guide' },
  locations: {
    heading: 'Placeholder locations heading',
    intro: 'Placeholder. The approved copy describes where the business works.',
    empty: 'No locations are published yet.',
  },
  pricing: {
    heading: 'Placeholder pricing heading',
    intro: 'Placeholder. The approved pricing copy replaces this text.',
    cta: { label: 'Estimate your project', href: '#estimate' },
  },
  book: {
    heading: 'Tell us about your project',
    intro: 'Placeholder introduction for the consultation form.',
    points: [],
    submitLabel: 'Book my consultation',
    footnote: 'Placeholder form footnote.',
    serviceOptions: ['New website', 'Redesign', 'Ecommerce', 'Web application', 'Search visibility', 'Care plan'],
    referralOptions: ['Search engine', 'AI assistant', 'Referral', 'Social media', 'Somewhere else'],
  },
  footer: {
    blurb: 'Placeholder. The approved one-paragraph description of Calwebtech replaces this text.',
    resources: [
      { label: 'Cost estimate', href: '#estimate' },
      { label: 'Insights', href: '#insights' },
      { label: 'Process', href: '#process' },
      { label: 'Before and after', href: '#beforeafter' },
    ],
    company: [
      { label: 'Recognition', href: '#awards' },
      { label: 'Technology', href: '#tech' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Locations', href: '#locations' },
      { label: 'Contact', href: '/book-a-consultation/' },
    ],
    legal: [
      { label: 'Privacy policy', href: '/privacy-policy/' },
      { label: 'Terms', href: '/terms/' },
      { label: 'Cookie policy', href: '/cookie-policy/' },
      { label: 'Accessibility', href: '/accessibility/' },
    ],
  },
  floatingCta: { label: 'Start a project', href: '/book-a-consultation/' },
};

/** Generic groupings; a column of vendor platforms would name real companies. */
export const HOME_SERVICE_GROUPS = [
  { slug: 'design-and-build', name: 'Design and build' },
  { slug: 'growth-and-care', name: 'Growth and care' },
];

export const HOME_SERVICES = [
  ['website-design', 'Website design', 'design-and-build'],
  ['web-applications', 'Web applications', 'design-and-build'],
  ['ecommerce', 'Ecommerce', 'design-and-build'],
  ['automation', 'Automation', 'growth-and-care'],
  ['search-visibility', 'Search visibility', 'growth-and-care'],
  ['care-plans', 'Care plans', 'growth-and-care'],
].map(([slug = '', title = '', group = '']) => ({
  slug,
  title,
  group,
  shortDescription: 'Placeholder description of this service.',
  answerBlock: 'Placeholder. The approved two to three sentence answer replaces this text before launch.',
  deliverables: ['Placeholder deliverable one', 'Placeholder deliverable two', 'Placeholder deliverable three'],
}));

export const HOME_INDUSTRIES = [
  ['manufacturing', 'Manufacturing'],
  ['distribution', 'Distribution'],
  ['software', 'Software'],
  ['healthcare', 'Healthcare'],
  ['real-estate', 'Real estate'],
  ['hospitality', 'Hospitality'],
  ['education', 'Education'],
].map(([slug = '', name = '']) => ({
  slug,
  name,
  heroCopy: 'Placeholder description for this industry.',
  answerBlock: 'Placeholder. The approved two to three sentence answer replaces this text before launch.',
}));

export const HOME_PROBLEM_ROUTER = ordinal.map((word) => ({
  question: `Placeholder problem ${word}`,
  answer: 'Placeholder answer. The approved copy describes what the team would do about this problem.',
}));
