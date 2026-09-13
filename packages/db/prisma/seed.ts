/**
 * Development seed for the campaign landing page.
 *
 * Every name, figure, quote and photograph below is PLACEHOLDER content copied
 * from reference/landing-page.html so the template can be reviewed. None of it
 * may be published. Replace each record with content supplied by Calwebtech.
 * The seed is idempotent: it upserts by natural key and can be re-run.
 */
import {
  SETTING_KEYS,
  landingPageContentSchema,
  leadNotificationRecipientsSchema,
  siteContactSchema,
  siteProofSchema,
  type LandingPageContentInput,
} from '@calwebtech/shared';
import { config } from 'dotenv';
import { createPrismaClient, Prisma } from '../src';

config({ path: ['.env', '../../.env'], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const prisma = createPrismaClient(databaseUrl);

const photo = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`;

async function seedSettings() {
  const contact = siteContactSchema.parse({
    phone: '+1 (800) 555-0188',
    phoneE164: '+18005550188',
    email: 'hello@calwebtech.com',
  });
  const proof = siteProofSchema.parse({ npsScore: 9.6, npsProjectCount: 41 });
  for (const [key, value] of [
    [SETTING_KEYS.contact, contact],
    [SETTING_KEYS.proof, proof],
  ] as const) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  // Placeholder until the client confirms the address: Resend's test inbox. `update: {}`
  // never overwrites an address set later with settings-cli, so re-seeding is safe.
  const recipients = leadNotificationRecipientsSchema.parse({ emails: ['delivered+leads@resend.dev'] });
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.leadNotificationRecipients },
    create: { key: SETTING_KEYS.leadNotificationRecipients, value: recipients },
    update: {},
  });

  const reviews = [
    { platform: 'Google', rating: 4.9, reviewCount: 96 },
    { platform: 'Clutch', rating: 4.9, reviewCount: 71 },
    { platform: 'DesignRush', rating: 5.0, reviewCount: 34 },
    { platform: 'GoodFirms', rating: 4.8, reviewCount: 16 },
  ];
  for (const review of reviews) {
    const data = { rating: new Prisma.Decimal(review.rating), reviewCount: review.reviewCount };
    await prisma.reviewSource.upsert({
      where: { platform: review.platform },
      create: { platform: review.platform, ...data },
      update: data,
    });
  }
}

/** Tables without a natural unique key are replaced wholesale in development. */
async function seedSharedProof() {
  await prisma.clientLogo.deleteMany();
  await prisma.clientLogo.createMany({
    data: ['NORTHMARK', 'Verona Home', 'HALLOWAY', 'Bridgeline', 'Cascadia Health', 'Truvia Labs', 'Meridian Parts'].map(
      (name, order) => ({ name, order }),
    ),
  });

  await prisma.processStep.deleteMany();
  await prisma.processStep.createMany({
    data: [
      {
        title: 'Discovery',
        timing: 'Week 1',
        summary: 'Positioning, audience, service catalogue, sitemap and a conversion map for every page.',
        heading: 'We work out what is actually wrong',
        body: 'A working session on positioning, buyers and the service catalogue. We map the primary action for every page and agree the sitemap before anyone opens a design tool.',
        youGet: ['Sitemap and conversion map', 'Content inventory', 'A fixed price, in writing'],
        weNeed: ['90 minutes of your team', 'Your service list', 'A named decision maker'],
        imageUrl: photo('photo-1454165804606-c3d57bc86b40', 900),
        imageAlt: 'Discovery workshop with the client team',
      },
      {
        title: 'Design',
        timing: 'Weeks 2 to 3',
        summary: 'Tokens, component library and high-fidelity screens for the pages that carry the money.',
        heading: 'You see real screens, not a mood board',
        body: 'Design tokens and a component library first, then high-fidelity screens for the pages that carry the money. Everything else is assembled from approved patterns, which is why this stage does not drag.',
        youGet: ['Figma file with edit access', '7 high-fidelity screens', 'One revision round included'],
        weNeed: ['Logo and brand assets', 'Copy, or approval to draft', 'Feedback within 2 days'],
        imageUrl: photo('photo-1561070791-2526d30994b5', 900),
        imageAlt: 'Interface design work in progress',
      },
      {
        title: 'Build',
        timing: 'Weeks 3 to 7',
        summary: 'Front end, API, dashboard and integrations, reviewed on a staging URL you can open any day.',
        heading: 'A staging URL you can open any day',
        body: 'Front end, API, dashboard and integrations, built in the open. Weekly progress notes, no black box, and nothing that only works on a demo day.',
        youGet: ['Live staging environment', 'Weekly progress call', 'Dashboard access early'],
        weNeed: ['Project content and images', 'Integration credentials', 'One consolidated review'],
        imageUrl: photo('photo-1498050108023-c5249f4df085', 900),
        imageAlt: 'Developer building the platform',
      },
      {
        title: 'Prove',
        timing: 'Week 8',
        summary: 'Cross-browser QA, accessibility audit, performance pass and a tested backup restore.',
        heading: 'We try to break it before your customers do',
        body: 'Cross-browser and cross-device QA, an accessibility audit, a performance pass against the written budget, structured data validation, redirect verification, and one tested backup restore.',
        youGet: ['Lighthouse 90+ on mobile', 'WCAG 2.2 AA audit report', 'A restore proven in front of you'],
        weNeed: ['Final copy sign-off', 'Legal page approval', 'A test run of your own'],
        imageUrl: photo('photo-1460925895917-afdab827c52f', 900),
        imageAlt: 'Performance and analytics review before launch',
      },
      {
        title: 'Launch',
        timing: 'Week 9',
        summary: 'DNS cutover, monitoring, two training sessions and the full documentation set.',
        heading: 'You leave owning all of it',
        body: 'DNS cutover, monitoring switched on, two recorded training sessions, a written operations manual, and every account transferred into your name through a password manager.',
        youGet: ['Code, database, design files', 'Two recorded training sessions', '60 day warranty'],
        weNeed: ['DNS access', 'Two people at training', 'Final acceptance sign-off'],
        imageUrl: photo('photo-1522071820081-009f0129c71c', 900),
        imageAlt: 'Handover and training session with the client team',
      },
    ].map((step, order) => ({ ...step, order })),
  });

  await prisma.pricingTier.deleteMany();
  await prisma.pricingTier.createMany({
    data: [
      { name: 'Focused build', priceLabel: '$12k to $25k', summary: 'Marketing site, custom design, CMS and lead capture. Six to eight weeks.' },
      { name: 'Platform build', priceLabel: '$25k to $60k', summary: 'Plus booking, dashboard, campaigns and integrations. Nine to fourteen weeks.', highlighted: true },
      { name: 'Ongoing partner', priceLabel: 'From $1.5k/mo', summary: 'Care, monitoring and a fixed development allowance. Month to month.' },
    ].map((tier, order) => ({ ...tier, order })),
  });
}

const PLACEHOLDER_ANSWER = 'PLACEHOLDER. Replace with a two to three sentence direct answer before publishing.';

async function seedProofRecords() {
  const industry = (slug: string, name: string) =>
    prisma.industry.upsert({
      where: { slug },
      create: { slug, name, answerBlock: PLACEHOLDER_ANSWER },
      update: { name },
    });
  const distribution = await industry('distribution', 'Distribution');
  const saas = await industry('saas', 'SaaS');

  const project = (slug: string, data: Omit<Prisma.ProjectUncheckedCreateInput, 'slug'>) =>
    prisma.project.upsert({ where: { slug }, create: { slug, ...data }, update: data });

  const northmark = await project('northmark-supply', {
    title: 'Northmark Supply quoting platform',
    clientName: 'Northmark Supply',
    summary: '40,000 parts behind a contact form, rebuilt as an account-priced quoting platform.',
    answerBlock: PLACEHOLDER_ANSWER,
    location: 'Ohio',
    industryId: distribution.id,
    coverImageUrl: photo('photo-1581094794329-c8112a89af12', 700),
    coverImageAlt: 'Industrial distribution facility',
    outcomeMetrics: [
      { value: '+312%', label: 'Quote requests' },
      { value: '12 min', label: 'Turnaround, from 3 days' },
      { value: '−41%', label: 'Support calls' },
    ],
    featured: true,
    year: 2025,
    status: 'PUBLISHED',
  });

  const truvia = await project('truvia-labs', {
    title: 'Truvia Labs design system',
    clientName: 'Truvia Labs',
    summary: 'Marketing site, docs and onboarding rebuilt on one design system.',
    answerBlock: PLACEHOLDER_ANSWER,
    location: 'Texas',
    industryId: saas.id,
    coverImageUrl: photo('photo-1519389950473-47ba0277781c', 700),
    coverImageAlt: 'Software product team at work',
    outcomeMetrics: [
      { value: '+140%', label: 'Demo bookings' },
      { value: '3.1x', label: 'Organic sessions' },
      { value: '98', label: 'Lighthouse mobile' },
    ],
    featured: true,
    year: 2024,
    status: 'PUBLISHED',
  });

  const halloway = await project('halloway-group', {
    title: 'Halloway Group redesign',
    clientName: 'Halloway Group',
    summary: 'A slow brochure site rebuilt around one primary action per page.',
    answerBlock: PLACEHOLDER_ANSWER,
    outcomeMetrics: [
      { value: '1.6s', label: 'Mobile load time' },
      { value: '38%', label: 'Bounce rate' },
      { value: '54', label: 'Enquiries per month' },
    ],
    beforeImageUrl: photo('photo-1498050108023-c5249f4df085', 1400),
    afterImageUrl: photo('photo-1460925895917-afdab827c52f', 1400),
    beforeAfterMetrics: [
      { label: 'Mobile load time', before: '6.8s', after: '1.6s' },
      { label: 'Bounce rate', before: '71%', after: '38%' },
      { label: 'Enquiries per month', before: '9', after: '54' },
    ],
    year: 2025,
    status: 'PUBLISHED',
  });

  await prisma.testimonial.deleteMany({ where: { source: 'placeholder' } });
  const testimonialSeed = [
    {
      clientName: 'Dale Ferris',
      role: 'Director of Ecommerce',
      company: 'Northmark Supply',
      avatarUrl: photo('photo-1472099645785-5658abf4ff4e', 120),
      quote: 'Our counter staff stopped retyping orders. That is the whole story. Calwebtech understood the ERP side better than the vendor who sold it to us.',
      date: new Date('2026-03-01'),
      projectId: northmark.id,
    },
    {
      clientName: 'Priya Raman',
      role: 'VP Marketing',
      company: 'Truvia Labs',
      avatarUrl: photo('photo-1494790108377-be9c29b29330', 120),
      quote: 'They pushed back on half of what we asked for and were right about most of it. Our enquiry quality went up before the volume did.',
      date: new Date('2026-02-01'),
      projectId: truvia.id,
    },
    {
      clientName: 'Marcus Bell',
      role: 'Communications Director',
      company: 'Cascadia Health',
      avatarUrl: photo('photo-1507003211169-0a1dd7228f2d', 120),
      quote: 'Fourteen clinic websites became one. Our staff publish their own updates now, which sounds small until you remember we used to wait nine days.',
      date: new Date('2026-01-01'),
    },
  ];
  const testimonials = [];
  for (const data of testimonialSeed) {
    testimonials.push(
      await prisma.testimonial.create({
        data: { ...data, source: 'placeholder', featured: true, consentAt: new Date() },
      }),
    );
  }

  const teamSeed = [
    ['sawkat-hasan', 'Sawkat Hasan', 'Founder', 'Joins every first call and every proposal. Twelve years in B2B commerce.', 'photo-1507003211169-0a1dd7228f2d'],
    ['rasel-mridha', 'Rasel Mridha', 'Chief Technology Officer', 'Owns architecture and delivery. Writes the technical plan behind your quote.', 'photo-1472099645785-5658abf4ff4e'],
    ['priya-raman', 'Priya Raman', 'Design Lead', 'Runs the design system and every high-fidelity screen you approve.', 'photo-1494790108377-be9c29b29330'],
    ['dana-whitfield', 'Dana Whitfield', 'Delivery Manager', 'Your weekly point of contact. Keeps the staging URL and the schedule honest.', 'photo-1438761681033-6461ffad8d80'],
  ] as const;
  const team = [];
  for (const [order, [slug, name, role, bio, photoId]] of teamSeed.entries()) {
    const data = { name, role, bio, photo: photo(photoId, 500), order, active: true };
    team.push(await prisma.teamMember.upsert({ where: { slug }, create: { slug, ...data }, update: data }));
  }

  const partnerSeed = [
    ['Shopify', 'Partner since 2019'],
    ['Google', 'Partner, Ads & Analytics'],
    ['Vercel', 'Agency partner'],
    ['Cloudflare', 'Certified deployment'],
  ] as const;
  await prisma.partner.deleteMany({ where: { name: { in: partnerSeed.map(([name]) => name) } } });
  const partners = [];
  for (const [order, [name, certification]] of partnerSeed.entries()) {
    partners.push(await prisma.partner.create({ data: { name, certification, order } }));
  }

  const technologySeed = [
    ['nextjs', 'Next.js', 'frontend'],
    ['react', 'React', 'frontend'],
    ['typescript', 'TypeScript', 'frontend'],
    ['wordpress', 'WordPress', 'cms'],
    ['shopify', 'Shopify', 'ecommerce'],
    ['postgresql', 'PostgreSQL', 'backend'],
    ['docker', 'Docker', 'infrastructure'],
    ['react-native', 'React Native', 'frontend'],
  ] as const;
  const technologies = [];
  for (const [order, [slug, name, category]] of technologySeed.entries()) {
    const data = { name, category, order };
    technologies.push(
      await prisma.technology.upsert({ where: { slug }, create: { slug, ...data }, update: data }),
    );
  }

  return { results: [northmark, truvia], beforeAfter: halloway, testimonials, team, partners, technologies };
}

const landingContent: LandingPageContentInput = {
  header: { ctaLabel: 'Get my free proposal' },
  hero: {
    badge: 'Taking 3 new B2B projects this quarter',
    heading: 'Your competitors are not better. Their website just answers faster.',
    intro: 'Calwebtech builds B2B websites that turn the traffic you already have into booked calls. Tell us what is broken and we will send a fixed quote and a plan within two business days. No retainer to find out.',
    bullets: [
      'A fixed price before you commit, not an hourly estimate that drifts',
      'Every lead lands in a database you own, exportable any day',
      'We sign your NDA before the first call, not after',
    ],
    stats: [
      { value: 240, suffix: '+', label: 'Projects delivered' },
      { value: 187, suffix: '%', label: 'Average lead uplift', isOutcome: true },
      { value: 12, suffix: ' yrs', label: 'Building for B2B' },
    ],
    backgroundImage: { src: photo('photo-1497366754035-f200968a6e72', 1900) },
  },
  heroForm: {
    heading: 'Get a free proposal',
    subheading: 'Two business days. No obligation, no drip sequence.',
    submitLabel: 'Send me a free proposal',
    assurances: ['NDA on request', 'No spam, ever', 'Reply in 2 days'],
  },
  formSuccess: {
    heading: 'Thanks. Your request is with us.',
    body: 'A person, not an autoresponder, will reply within one business day to book a thirty minute call.',
  },
  trustBar: { label: 'Trusted by B2B teams across California and the US' },
  problem: {
    heading: 'You are not losing deals at the pitch. You are losing them at 11pm on a Tuesday.',
    intro: 'That is when a buyer is comparing four suppliers on a phone, and picking the two that made the decision easy. Here is what usually costs you that shortlist.',
    cards: [
      { figure: '8 of 10', body: 'visitors leave without ever identifying themselves, because the only option is a contact form.' },
      { figure: '3 days', body: 'is the average quote turnaround in B2B. Your competitor answers in minutes and wins on speed alone.' },
      { figure: '6.8s', body: 'is what a typical page-builder site loads in on mobile. Most buyers are gone by second four.' },
      { figure: '9 days', body: 'to change a phone number, because every edit needs a developer and a deployment.' },
    ],
  },
  solution: {
    heading: 'We fix the four things that actually move the number',
    steps: [
      { title: 'One clear action on every page', body: 'We map the primary action for each page and remove everything competing with it. Proof goes before every ask, never after.' },
      { title: 'More ways in than a contact form', body: 'Instant estimator, consultation booking, quick quote, resource download. Different buyers are ready at different moments.' },
      { title: 'Speed as a contractual target', body: 'Load time, layout shift and script weight are written into the build and checked on every release, not promised in a deck.' },
      { title: 'A dashboard your team can actually use', body: 'Publish a page, edit a price, answer a lead. No tickets, no deployments, no waiting on us.' },
    ],
    image: { src: photo('photo-1454165804606-c3d57bc86b40', 1100), alt: 'A team reviewing website performance figures together' },
  },
  services: {
    heading: 'Everything the project needs, from one team',
    intro: 'No handoffs between a design shop, a developer and a hosting vendor. One contract, one point of contact, one team that owns the outcome.',
    items: [
      { title: 'Website design and build', body: 'Custom design mapped to how your buyers decide, built on Next.js or WordPress depending on what you need to maintain.' },
      { title: 'Ecommerce and quoting', body: 'Account pricing, tiered terms, configurators and quote-to-order flows, wired into the systems you already run.' },
      { title: 'ERP and CRM integration', body: 'Inventory, pricing and order data flowing both ways, so nobody on your team retypes anything.' },
      { title: 'Search and AI visibility', body: 'Technical SEO plus the newer work of being cited when a buyer asks ChatGPT or Perplexity who to hire.' },
      { title: 'Performance engineering', body: 'Rebuilding a slow site into a fast one without losing the rankings and traffic you already have.' },
      { title: 'Care and hosting', body: 'Patching, backups with a tested restore, monitoring and a fixed allowance of dev hours. Month to month.' },
    ],
  },
  results: {
    heading: 'The numbers our clients kept',
    intro: "Measured in the client's own analytics twelve months after launch. Every figure is one they agreed to publish.",
    ctaLabel: 'Get a plan for your site',
  },
  process: {
    badge: 'Six to fourteen weeks, start to handover',
    heading: 'Five steps, and you know the price at step one',
    intro: 'No discovery retainer, no phased quotes that grow. Click through each step to see what happens, what you get, and what we need from you.',
    backgroundImage: { src: photo('photo-1518770660439-4636190af475', 1800) },
  },
  beforeAfter: {
    heading: 'Drag it and see the difference',
    intro: 'Most of our work is a rescue, not a launch. Here is one client homepage before and after, at the same scroll position, on the same screen.',
    ctaLabel: 'Get a redesign plan',
  },
  partners: {
    heading: 'Certified where it counts',
    intro: 'Partnerships mean direct support channels and early access when something breaks on a Friday afternoon.',
    technologiesLabel: 'Built with',
  },
  team: {
    heading: 'The people in the pitch are the people who build it',
    intro: 'No handover to a junior team once the contract is signed. This is who you would be working with.',
  },
  testimonials: {
    heading: 'What clients say when we are not in the room',
    backgroundImage: { src: photo('photo-1521737604893-d14cc237f11d', 1800) },
  },
  guarantees: {
    heading: 'Four commitments, written into the contract',
    items: [
      { title: 'Fixed price, fixed scope', body: 'The number in the proposal is the number you pay. Changes are quoted before any work starts.' },
      { title: 'You own everything', body: 'Code, database, accounts and design files transfer to you at handover. No hostage situations.' },
      { title: '60 day warranty', body: 'Anything that does not behave as specified is fixed free, with a four hour response on critical issues.' },
      { title: 'No lock-in after launch', body: 'Care plans are month to month. If we stop being useful you can leave and take the code.' },
    ],
  },
  pricing: {
    heading: 'What this usually costs',
    intro: 'Published openly so you can tell in ninety seconds whether we are in your range. Every project is quoted fixed after the call.',
    ctaLabel: 'Get my exact number',
    backgroundImage: { src: photo('photo-1504384308090-c894fdcc538d', 1800) },
  },
  faq: {
    heading: 'Before you fill in the form',
    intro: 'The questions we get asked most, answered without the sales hedge.',
    callLabel: 'Or just call us',
  },
  finalCta: {
    heading: 'Tell us what is broken',
    intro: 'One form, one reply, one honest answer about whether we can help. Nothing else happens to your details.',
    points: [
      { icon: 'check', title: 'Reply within one business day', body: 'From a person, not an autoresponder.' },
      { icon: 'shield', title: 'NDA signed before we talk', body: 'Send yours, or use ours.' },
      { icon: 'calendar', title: 'Fixed proposal in two days', body: 'Scope, timeline, price and exclusions in writing.' },
    ],
    backgroundImage: { src: photo('photo-1556761175-b413da4baf72', 1800) },
    submitLabel: 'Send me a free proposal',
    serviceOptions: ['New website', 'Redesign', 'Ecommerce', 'Integration', 'SEO and AI visibility', 'Care plan'],
    formFootnote: 'Protected by bot filtering. We never sell or share your details, and you can ask us to delete them at any time.',
  },
};

const landingFaqs = [
  ['How long does a project take?', 'Six to eight weeks for a marketing site, nine to fourteen for a platform build with booking, a dashboard and integrations. The most common cause of delay is content, not code, which is why the proposal names the dates we need things from you.'],
  ['What if we already have a developer?', 'That is common and usually fine. We can take design and front end and leave the back end with your team, or work the other way round. The proposal will say exactly where the boundary sits so nobody is guessing.'],
  ['Will we lose our search rankings?', 'Not if the migration is done properly. We map every existing URL to its new destination with permanent redirects before launch, keep the content that is earning traffic, and monitor Search Console for the first thirty days. Rankings normally recover within two to three weeks and then improve on the performance gain.'],
  ['Who owns the site when it is finished?', 'You do, completely. The repository, the database, the design files and every third party account are registered in your name and transferred at handover through a password manager. There is no proprietary format and no vendor holding your data.'],
  ['We are not in California. Does that matter?', 'No. Most of our clients are outside our home metro. We work across US time zones with a weekly call, a shared project board and a staging URL you can open at any hour. If you would rather meet in person, say so on the call and we will tell you honestly whether that is practical.'],
  ['What happens after I submit this form?', 'We look at your current site, then email you within one business day to book a thirty minute call. After that call you get a written proposal with scope, timeline and a fixed price within two business days. If we are not the right fit we will say so and point you somewhere better.'],
] as const;

async function seedLandingPage(refs: Awaited<ReturnType<typeof seedProofRecords>>) {
  const content = landingPageContentSchema.parse(landingContent) as Prisma.InputJsonObject;
  const connect = (records: { id: string }[]) => records.map(({ id }) => ({ id }));
  const data = {
    name: 'B2B website design',
    status: 'PUBLISHED' as const,
    noindex: true,
    publishedAt: new Date(),
    content,
    seo: {
      title: 'B2B Website Design & Development | Calwebtech',
      description: 'Calwebtech builds B2B websites that turn traffic into booked calls. Fixed quote after a free 30-minute consultation. Serving California and the US.',
    },
    beforeAfterProject: { connect: { id: refs.beforeAfter.id } },
  };
  const relations = {
    results: { set: connect(refs.results) },
    testimonials: { set: connect(refs.testimonials) },
    team: { set: connect(refs.team) },
    partners: { set: connect(refs.partners) },
    technologies: { set: connect(refs.technologies) },
  };

  const page = await prisma.landingPage.upsert({
    where: { slug: 'b2b-website-design' },
    create: {
      slug: 'b2b-website-design',
      ...data,
      results: { connect: connect(refs.results) },
      testimonials: { connect: connect(refs.testimonials) },
      team: { connect: connect(refs.team) },
      partners: { connect: connect(refs.partners) },
      technologies: { connect: connect(refs.technologies) },
    },
    update: { ...data, ...relations },
  });

  await prisma.faq.deleteMany({ where: { landingPageId: page.id } });
  await prisma.faq.createMany({
    data: landingFaqs.map(([question, answer], order) => ({
      question,
      answer,
      order,
      group: 'landing',
      landingPageId: page.id,
    })),
  });
  return page;
}

async function main() {
  await seedSettings();
  await seedSharedProof();
  const refs = await seedProofRecords();
  const page = await seedLandingPage(refs);
  console.log(`Seeded placeholder landing page at /lp/${page.slug}/`);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
