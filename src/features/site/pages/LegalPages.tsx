import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { BRAND, CONTACT, DISCLAIMER } from '../content';

interface LegalSection {
  title: string;
  body: string[];
}

const LAST_UPDATED = '15 November 2026';

const contactLine = CONTACT.email
  ? `Questions can be sent to ${CONTACT.email}.`
  : 'Questions can be sent to us through the enquiry form on this website.';

/** DRAFT text for review by the owner / a qualified lawyer before public launch. */
const PRIVACY: LegalSection[] = [
  {
    title: 'Who we are',
    body: [
      `This website is operated by ${BRAND.name}. This policy explains how we handle personal information submitted through this website.`,
    ],
  },
  {
    title: 'Information we collect',
    body: [
      'When you submit an enquiry we collect the details you provide: your name, email address, and optionally your phone number, city, area of interest and message.',
      'We do not use advertising trackers or third-party analytics on this website. Clients who sign in to the client portal are covered by their client agreement.',
    ],
  },
  {
    title: 'How we use it',
    body: [
      'We use enquiry details only to respond to your enquiry, to assess whether our services may be suitable and eligible for you, and to keep a record of our communication.',
      'We do not sell your personal information or share it for marketing by others.',
    ],
  },
  {
    title: 'Where it is stored and who can see it',
    body: [
      'Enquiries are stored securely with our database provider. Access is restricted to authorised WINTECH administrators.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep enquiry records for as long as needed to respond and for reasonable record-keeping, unless the law requires a longer period.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      `You may ask us to access, correct or delete the details you submitted, or to stop contacting you. ${contactLine}`,
    ],
  },
  {
    title: 'Changes to this policy',
    body: ['We may update this policy. The date at the top shows when it last changed.'],
  },
];

const TERMS: LegalSection[] = [
  {
    title: 'About this website',
    body: [
      `This website provides general information about ${BRAND.name} and its proposed investment approach. It is not an offer, solicitation or recommendation to buy or sell any security or to enter into any investment arrangement.`,
    ],
  },
  {
    title: 'No investment advice',
    body: [
      'Nothing on this website is personalised investment, tax or legal advice. Consider your objectives, financial situation and risk tolerance, and seek professional advice where appropriate.',
    ],
  },
  {
    title: 'Services subject to authorisation and agreement',
    body: [
      'Any investment services are provided only under a legally compliant arrangement, subject to applicable laws, regulations, registrations and authorisations, and to the terms of a signed client agreement. Fees and their calculation are disclosed before any arrangement begins.',
    ],
  },
  {
    title: 'Risks and no guarantees',
    body: [
      DISCLAIMER,
      'Past performance is not necessarily indicative of future results. The value of investments can go down as well as up.',
    ],
  },
  {
    title: 'Enquiries',
    body: [
      'Submitting an enquiry does not create a client relationship or any obligation for either party. Eligibility, disclosures and documentation are reviewed first.',
    ],
  },
  {
    title: 'Client portal',
    body: [
      'Access to the client portal is limited to authorised clients. Figures shown there are indicative and governed by the client agreement.',
    ],
  },
  {
    title: 'Content and liability',
    body: [
      'We aim to keep this website accurate but do not warrant that it is complete or current. To the extent permitted by law, we are not liable for losses arising from reliance on this website.',
    ],
  },
  {
    title: 'Governing law',
    body: ['These terms are governed by the laws of India.'],
  },
];

function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  useEffect(() => {
    document.title = `${title} · ${BRAND.name}`;
  }, [title]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded-full brand-rule" />
      <p className="mt-4 text-sm text-muted">Last updated: {LAST_UPDATED}</p>
      <p
        role="note"
        className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
        Draft for review. This text has not yet been reviewed by a qualified lawyer.
      </p>
      <div className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold">
              {i + 1}. {s.title}
            </h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 text-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return <LegalPage title="Privacy Policy" sections={PRIVACY} />;
}

export function TermsPage() {
  return <LegalPage title="Terms & Conditions" sections={TERMS} />;
}
