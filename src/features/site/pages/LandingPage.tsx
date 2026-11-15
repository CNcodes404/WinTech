import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Mail,
  MapPin,
  Phone,
  Globe,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  ABOUT,
  APPROACH,
  BRAND,
  CONTACT,
  CONTACT_COPY,
  FAQS,
  FEES,
  HIGHLIGHTS,
  HOME,
  JOURNEY,
  RISK,
  SECTORS,
  WHY,
} from '../content';
import { EnquiryForm } from '../components/EnquiryForm';
import { PerformanceSection } from '../components/PerformanceSection';
import { Reveal, SectionHeading } from '../components/Reveal';

/** Accent colours for icon tiles (decorative; text stays dark on white). */
const TILE = [
  'from-emerald-500 to-teal-500',
  'from-sky-500 to-cyan-500',
  'from-indigo-500 to-violet-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-teal-500 to-emerald-500',
  'from-violet-500 to-fuchsia-500',
  'from-cyan-500 to-sky-500',
  'from-orange-500 to-amber-500',
  'from-fuchsia-500 to-violet-500',
];

function IconTile({
  icon: Icon,
  i,
  size = 'md',
}: {
  icon: React.ElementType;
  i: number;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md',
        TILE[i % TILE.length],
        size === 'lg' ? 'size-14' : 'size-11',
      )}
    >
      <Icon aria-hidden="true" className={size === 'lg' ? 'size-7' : 'size-5'} />
    </span>
  );
}

/** Decorative market-style chart (no figures; nothing here implies returns). */
function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md animate-float">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-emerald-400/30 via-sky-400/20 to-indigo-500/30 blur-2xl" />
      <div className="relative rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-emerald-200 uppercase">Research-led</p>
            <p className="mt-1 text-lg font-bold text-white">Diversified portfolio</p>
          </div>
          <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
            Multi-sector
          </span>
        </div>
        <svg viewBox="0 0 320 140" className="mt-6 w-full">
          <defs>
            <linearGradient id="heroLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="60%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[30, 65, 100].map((y) => (
            <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="white" strokeOpacity="0.08" />
          ))}
          <path
            d="M0 118 L40 104 L80 110 L120 86 L160 92 L200 64 L240 70 L280 42 L320 30 L320 140 L0 140 Z"
            fill="url(#heroFill)"
          />
          <path
            d="M0 118 L40 104 L80 110 L120 86 L160 92 L200 64 L240 70 L280 42 L320 30"
            fill="none"
            stroke="url(#heroLine)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
          />
        </svg>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
          {['Banking', 'IT', 'Healthcare', 'Energy', 'FMCG', 'Infra'].map((s, i) => (
            <span
              key={s}
              className={cn(
                'rounded-lg px-2 py-1.5 text-white',
                ['bg-emerald-500/30', 'bg-sky-500/30', 'bg-indigo-500/30'][i % 3],
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      id="home"
      className="relative -mt-16 overflow-hidden bg-gradient-to-br from-navy-900 via-[#16294a] to-[#1e2a64] pt-28 pb-20 text-white sm:pb-28"
    >
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-32 size-[32rem] rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-indigo-500/25 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-widest text-emerald-200 uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
              {BRAND.tagline}
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mt-6 text-4xl leading-tight font-extrabold text-white sm:text-5xl lg:text-6xl">
              {HOME.heading.split(' Through ')[0]}{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                through smarter investment decisions
              </span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-xl text-lg text-navy-100">{BRAND.promise}</p>
            <p className="mt-2 max-w-xl text-base text-navy-200">{HOME.paragraphs[0]}</p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] bg-gradient-to-r from-emerald-500 to-teal-600 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-600 hover:to-teal-700"
              >
                Get started
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              <a
                href="#approach"
                className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white hover:bg-white/10"
              >
                Our investment approach
              </a>
            </div>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <HeroVisual />
        </Reveal>
      </div>

      <div className="relative mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h, i) => (
            <li key={h.title}>
              <Reveal delay={i * 80}>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <IconTile icon={h.icon} i={i} />
                  <div>
                    <p className="font-bold text-white">{h.title}</p>
                    <p className="text-sm text-navy-200">{h.text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Welcome() {
  return (
    <section aria-labelledby="welcome-title" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase">
            Welcome to {BRAND.name}
          </p>
          <h2 id="welcome-title" className="mt-3 text-3xl font-bold sm:text-4xl">
            {HOME.heading}
          </h2>
          <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded-full brand-rule" />
          {HOME.paragraphs.slice(1).map((p) => (
            <p key={p} className="mt-4 text-muted">
              {p}
            </p>
          ))}
          <p className="mt-6 text-lg font-bold text-ink">
            {BRAND.name} – {BRAND.motto}
          </p>
        </Reveal>
        <div>
          <h3 className="sr-only">Our focus</h3>
          <ul className="grid gap-4 sm:grid-cols-2">
            {HOME.focus.map((f, i) => (
              <li key={f.title}>
                <Reveal delay={i * 70}>
                  <div className="flex h-full items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
                    <IconTile icon={f.icon} i={i} />
                    <p className="font-semibold">{f.title}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="bg-gradient-to-b from-emerald-50/60 via-white to-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow="About us" title={ABOUT.heading} />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <div className="space-y-4 text-muted">
              {ABOUT.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </Reveal>
          <div className="grid gap-4">
            {[
              { icon: Eye, title: 'Our Vision', text: ABOUT.vision, cls: 'from-navy-900 to-[#1e2a64]' },
              {
                icon: Target,
                title: 'Our Mission',
                text: ABOUT.mission,
                cls: 'from-emerald-700 to-teal-800',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 120}>
                <div className={cn('rounded-2xl bg-gradient-to-br p-6 text-white shadow-lg', c.cls)}>
                  <div className="flex items-center gap-3">
                    <c.icon aria-hidden="true" className="size-6 text-emerald-300" />
                    <h3 className="text-xl font-bold text-white">{c.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/85">{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <h3 className="mt-16 text-center text-2xl font-bold">Our Core Values</h3>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ABOUT.values.map((v, i) => (
            <li key={v.title}>
              <Reveal delay={i * 80} className="h-full">
                <div className="h-full rounded-2xl border border-line bg-white p-5 text-center shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
                  <div className="flex justify-center">
                    <IconTile icon={v.icon} i={i} size="lg" />
                  </div>
                  <h4 className="mt-4 text-lg font-bold">{v.title}</h4>
                  <p className="mt-2 text-sm text-muted">{v.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Sectors() {
  return (
    <section id="sectors" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="Our investment sectors" title={SECTORS.heading} intro={SECTORS.intro} />
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SECTORS.items.map((s, i) => (
          <li key={s.title}>
            <Reveal delay={(i % 5) * 70} className="h-full">
              <div className="group relative h-full overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', TILE[i % TILE.length])}
                />
                <IconTile icon={s.icon} i={i} />
                <h3 className="mt-4 text-base font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Approach() {
  return (
    <section
      id="approach"
      className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-[#16294a] to-[#1e2a64] py-20 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 size-96 rounded-full bg-sky-500/15 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Our investment approach"
          title={APPROACH.heading}
          intro={APPROACH.intro}
          light
        />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {APPROACH.steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={(i % 3) * 100} className="h-full">
                <div className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors hover:bg-white/10">
                  <span
                    className="absolute top-5 right-5 text-5xl font-extrabold text-white/10"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <IconTile icon={s.icon} i={i} />
                  <p className="mt-4 text-xs font-bold tracking-widest text-emerald-300 uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm text-navy-100">{s.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Journey() {
  return (
    <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="How it works" title={JOURNEY.heading} />
      <ol className="relative mt-12 space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[1.35rem] before:w-0.5 before:bg-gradient-to-b before:from-emerald-400 before:via-sky-400 before:to-indigo-400 sm:before:left-1/2">
        {JOURNEY.steps.map((s, i) => {
          const left = i % 2 === 0;
          return (
            <li key={s.title} className="relative sm:grid sm:grid-cols-2 sm:gap-10">
              <span
                aria-hidden="true"
                className="absolute top-3 left-0 flex size-11 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-500 to-sky-500 text-sm font-bold text-white shadow-md sm:left-1/2 sm:-translate-x-1/2"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <Reveal
                delay={80}
                className={cn(
                  'pl-16 sm:pl-0',
                  left ? 'sm:col-start-1 sm:pr-10 sm:text-right' : 'sm:col-start-2 sm:pl-10',
                )}
              >
                <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
                  <h3 className="text-lg font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{s.text}</p>
                </div>
              </Reveal>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Fees() {
  return (
    <section id="fees" className="bg-gradient-to-b from-sky-50/70 via-white to-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow="Our fee structure" title={FEES.heading} intro={FEES.intro} />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {FEES.items.map((f, i) => (
            <li key={f.title}>
              <Reveal delay={i * 100} className="h-full">
                <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
                  <div className="flex items-center gap-3">
                    <IconTile icon={f.icon} i={i + 1} />
                    <span className="text-sm font-bold text-muted">{String.fromCharCode(65 + i)}.</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted">{f.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <Reveal>
          <p className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <span>
              <strong>Important:</strong> {FEES.important}
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Why() {
  return (
    <section aria-labelledby="why-title" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase">Why {BRAND.name}?</p>
          <h2 id="why-title" className="mt-3 text-3xl font-bold sm:text-4xl">
            {WHY.heading}
          </h2>
          <span aria-hidden="true" className="mt-4 block h-1 w-16 rounded-full brand-rule" />
          <blockquote className="mt-6 border-l-4 border-emerald-500 pl-4 text-lg font-medium text-ink italic">
            {WHY.closing}
          </blockquote>
        </Reveal>
        <ul className="grid gap-3 sm:grid-cols-2">
          {WHY.points.map((p, i) => (
            <li key={p}>
              <Reveal delay={(i % 4) * 70}>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-white">
                    <Check aria-hidden="true" className="size-4" />
                  </span>
                  <span className="font-semibold">{p}</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Risk() {
  return (
    <section id="risk" className="bg-gradient-to-br from-amber-50 via-orange-50/60 to-white py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeading eyebrow="Risk disclosure" title={RISK.heading} />
        <Reveal>
          <ul className="mt-10 space-y-3 rounded-2xl border border-amber-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            {RISK.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm sm:text-base">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="Frequently asked questions" title="Answers to common questions" />
      <div className="mt-10 space-y-3">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 50}>
            <details className="group rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] open:shadow-[var(--shadow-card-hover)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="mr-2 text-emerald-700">Q{i + 1}.</span>
                  {f.q}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-line px-5 py-4 text-sm text-muted">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const details = [
    { icon: Mail, label: 'Email', value: CONTACT.email, href: CONTACT.email && `mailto:${CONTACT.email}` },
    {
      icon: Phone,
      label: 'Phone',
      value: CONTACT.phone,
      href: CONTACT.phone && `tel:${CONTACT.phone.replace(/\s/g, '')}`,
    },
    { icon: MapPin, label: 'Office', value: CONTACT.address, href: '' },
    { icon: Globe, label: 'Website', value: CONTACT.website, href: CONTACT.website },
  ].filter((d) => d.value);
  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-[#16294a] to-[#1e2a64] py-20"
    >
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-20 size-96 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <div>
          <SectionHeading
            eyebrow="Contact us"
            title={CONTACT_COPY.heading}
            intro={CONTACT_COPY.intro}
            light
            center={false}
          />
          {details.length > 0 && (
            <Reveal>
              <ul className="mt-8 space-y-3">
                {details.map((d) => (
                  <li key={d.label} className="flex items-start gap-3 text-navy-100">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300">
                      <d.icon aria-hidden="true" className="size-5" />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold tracking-wide text-navy-300 uppercase">
                        {d.label}
                      </span>
                      {d.href ? (
                        <a href={d.href} className="font-medium text-white hover:underline">
                          {d.value}
                        </a>
                      ) : (
                        <span className="font-medium text-white">{d.value}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="h-1.5 brand-rule" />
            <h3 className="px-6 pt-6 text-xl font-bold sm:px-8">Send us an enquiry</h3>
            <EnquiryForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingPage() {
  useEffect(() => {
    document.title = `${BRAND.name} – ${BRAND.tagline}`;
  }, []);
  return (
    <>
      <Hero />
      <Welcome />
      <About />
      <Sectors />
      <Approach />
      <PerformanceSection />
      <Journey />
      <Fees />
      <Why />
      <Risk />
      <Faq />
      <Contact />
    </>
  );
}
