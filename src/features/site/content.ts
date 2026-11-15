import {
  Activity,
  Building2,
  Car,
  ChartLine,
  ChartPie,
  ClipboardList,
  Cpu,
  Eye,
  FileCheck,
  FileSignature,
  HandHeart,
  Handshake,
  HeartPulse,
  Landmark,
  Layers,
  Microscope,
  Pickaxe,
  RadioTower,
  Receipt,
  Repeat,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Target,
  UserCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * All public-website copy in one place (supplied by the owner, 15 Nov 2026).
 * Edit text here; components only lay it out.
 */

export const BRAND = {
  name: 'WINTECH',
  tagline: 'Smart Investment. Strategic Growth.',
  promise: 'Your Capital. Our Strategy. Your Financial Goals.',
  motto: 'Investing Today. Building Tomorrow.',
  pillars: ['Research', 'Discipline', 'Diversification', 'Transparency'],
};

/**
 * Contact details. Leave a value empty ('') to hide it on the website.
 * TODO(owner): fill in the official details.
 */
export const CONTACT = {
  email: '',
  phone: '',
  address: '',
  website: '',
};

export interface SiteSection {
  id: string;
  label: string;
}

/** In-page sections, in order (also the header navigation). */
export const SECTIONS: SiteSection[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'sectors', label: 'Sectors' },
  { id: 'approach', label: 'Approach' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'fees', label: 'Fees' },
  { id: 'faq', label: 'FAQs' },
  { id: 'contact', label: 'Contact' },
];

export interface IconItem {
  icon: LucideIcon;
  title: string;
  text?: string;
}

export const HOME = {
  heading: 'Building Wealth Through Smarter Investment Decisions',
  paragraphs: [
    'Welcome to WINTECH, where research, strategic thinking, and disciplined investment approaches come together.',
    'We focus on identifying investment opportunities across multiple sectors of the Indian stock market. Our objective is to build diversified investment portfolios by evaluating companies, analysing market trends, and following structured investment strategies.',
    'We believe that successful investing requires patience, knowledge, discipline, and responsible risk management.',
  ],
  focus: [
    { icon: Layers, title: 'Multi-Sector Stock Market Investments' },
    { icon: Microscope, title: 'Research-Based Investment Strategies' },
    { icon: ChartPie, title: 'Portfolio Diversification' },
    { icon: ChartLine, title: 'Professional Investment Analysis' },
    { icon: Receipt, title: 'Transparent Fee Structure' },
    { icon: Sprout, title: 'Long-Term Wealth Creation' },
  ] satisfies IconItem[],
};

export const ABOUT = {
  heading: 'Who We Are',
  paragraphs: [
    'WINTECH is an investment-focused financial services brand committed to exploring opportunities in the stock market through research-driven strategies and disciplined investment practices.',
    'Our approach is based on identifying promising companies across different industries, analysing their financial performance, evaluating market conditions, and developing diversified investment strategies.',
    'We aim to create a professional investment experience through transparency, structured processes, responsible decision-making, and clear communication.',
    'We believe every investment decision should be supported by proper research and a clear understanding of the associated risks.',
  ],
  vision:
    'To build WINTECH into a trusted investment management brand recognised for professionalism, transparency, research, and disciplined investment practices.',
  mission:
    'To explore opportunities across different stock market sectors and pursue sustainable investment growth through strategic analysis, diversification, and responsible risk management.',
  values: [
    {
      icon: Eye,
      title: 'Transparency',
      text: 'Clear communication regarding investment activities, fees, and risks.',
    },
    {
      icon: Search,
      title: 'Research',
      text: 'Investment decisions supported by financial and market analysis.',
    },
    { icon: Layers, title: 'Diversification', text: 'Exploring opportunities across multiple industries.' },
    {
      icon: Scale,
      title: 'Discipline',
      text: 'Following structured investment strategies rather than emotional decisions.',
    },
    {
      icon: HandHeart,
      title: 'Client Commitment',
      text: 'Keeping client interests, agreed objectives, and risk disclosures at the centre of our approach.',
    },
  ] satisfies IconItem[],
};

export const SECTORS = {
  heading: 'Opportunities Across Multiple Industries',
  intro: 'WINTECH focuses on researching investment opportunities across a broad range of market sectors.',
  items: [
    {
      icon: Landmark,
      title: 'Banking & Financial Services',
      text: 'Analysing banks, financial institutions, insurance companies, and other financial businesses.',
    },
    {
      icon: Cpu,
      title: 'Information Technology',
      text: 'Exploring companies involved in software, IT services, digital technology, and innovation.',
    },
    {
      icon: HeartPulse,
      title: 'Healthcare & Pharmaceuticals',
      text: 'Researching pharmaceutical manufacturers, hospitals, healthcare services, and medical technology companies.',
    },
    {
      icon: Car,
      title: 'Automobile & Manufacturing',
      text: 'Evaluating automobile manufacturers, auto components, industrial production, and engineering companies.',
    },
    {
      icon: Building2,
      title: 'Infrastructure & Construction',
      text: 'Exploring opportunities in infrastructure development, construction, capital goods, and related industries.',
    },
    {
      icon: Zap,
      title: 'Energy & Power',
      text: 'Analysing power generation, renewable energy, electricity, and energy-related businesses.',
    },
    {
      icon: ShoppingBasket,
      title: 'FMCG & Consumer Goods',
      text: 'Researching consumer-focused businesses, food products, household products, and retail-related companies.',
    },
    {
      icon: Pickaxe,
      title: 'Metals & Mining',
      text: 'Evaluating companies operating in steel, aluminium, mining, and other industrial materials.',
    },
    {
      icon: RadioTower,
      title: 'Telecom & Communication',
      text: 'Exploring telecommunications, networking, and communication technology businesses.',
    },
    {
      icon: Sparkles,
      title: 'Emerging & Other Sectors',
      text: 'Identifying potential opportunities in other industries based on research, valuation, and market conditions.',
    },
  ] satisfies IconItem[],
};

export const APPROACH = {
  heading: 'A Structured Approach to Investing',
  intro: 'Our investment philosophy is based on a disciplined process.',
  steps: [
    {
      icon: Search,
      title: 'Market Research',
      text: 'Studying market conditions, economic developments, and sector trends.',
    },
    {
      icon: Microscope,
      title: 'Company Analysis',
      text: 'Evaluating company fundamentals, financial performance, business models, and valuations.',
    },
    {
      icon: Target,
      title: 'Investment Selection',
      text: 'Identifying investment opportunities based on defined research criteria and investment objectives.',
    },
    {
      icon: ChartPie,
      title: 'Portfolio Diversification',
      text: 'Considering exposure across different sectors and companies to manage concentration risk.',
    },
    {
      icon: Activity,
      title: 'Portfolio Monitoring',
      text: 'Reviewing investment performance, market developments, and portfolio risk.',
    },
    {
      icon: FileCheck,
      title: 'Reporting',
      text: 'Providing investment-related reports and fee information in accordance with applicable requirements and contractual arrangements.',
    },
  ] satisfies IconItem[],
};

export const JOURNEY = {
  heading: 'A Clear and Structured Investment Journey',
  steps: [
    {
      icon: ClipboardList,
      title: 'Initial Enquiry',
      text: 'Clients submit an enquiry to understand the investment services and applicable eligibility requirements.',
    },
    {
      icon: UserCheck,
      title: 'Client Assessment',
      text: 'Investment objectives, financial circumstances, risk tolerance, and eligibility are assessed.',
    },
    {
      icon: FileSignature,
      title: 'Documentation & Agreement',
      text: 'Applicable disclosures, investment agreements, fee terms, risk factors, and other required documentation are completed.',
    },
    {
      icon: Handshake,
      title: 'Investment Process',
      text: 'Subject to applicable regulatory authorisation and agreed arrangements, investment activities are carried out in accordance with the approved investment mandate.',
    },
    {
      icon: Activity,
      title: 'Portfolio Monitoring',
      text: 'Investments are monitored and reviewed based on market conditions and the agreed strategy.',
    },
    {
      icon: FileCheck,
      title: 'Performance & Fee Reporting',
      text: 'Investment performance, applicable fees, expenses, and net results are communicated through appropriate reports.',
    },
    {
      icon: Repeat,
      title: 'Settlement & Withdrawal',
      text: 'Withdrawals and settlements are processed according to the applicable agreement, regulatory requirements, and operational procedures.',
    },
  ] satisfies IconItem[],
};

export const FEES = {
  heading: 'Transparent & Performance-Oriented Fee Model',
  intro:
    'WINTECH follows a proposed combination of fixed management fees and performance-based fees, subject to applicable regulatory approval and the executed client agreement.',
  items: [
    {
      icon: Wallet,
      title: 'Fixed Management Fee',
      text: 'A mutually agreed management fee for eligible investment management services.',
    },
    {
      icon: ChartLine,
      title: 'Performance-Based Fee',
      text: 'A performance-linked fee calculated according to the agreed methodology and applicable regulations.',
    },
    {
      icon: Receipt,
      title: 'Net Investment Proceeds',
      text: "The client's net proceeds, where applicable, are calculated after accounting for investment gains or losses, agreed fees, brokerage, statutory charges, taxes, and other applicable expenses.",
    },
  ] satisfies IconItem[],
  important:
    'All fees, calculation methods, applicable conditions, and payment arrangements will be disclosed clearly before any investment arrangement begins. No fixed or guaranteed investment return is promised.',
};

export const WHY = {
  heading: 'A Disciplined Approach to Financial Growth',
  points: [
    'Multi-Sector Investment Research',
    'Structured Investment Strategies',
    'Diversification Across Industries',
    'Research-Based Stock Selection',
    'Risk-Focused Decision-Making',
    'Transparent Fee Disclosures',
    'Investment Performance Reporting',
    'Professional Client Communication',
  ],
  closing:
    'We believe that trust is built through transparency, discipline, and responsible investment practices.',
};

export const RISK = {
  heading: 'Understand the Risks Before Investing',
  points: [
    'Investments in the stock market are subject to market risks.',
    'The value of investments can increase or decrease depending on market conditions, economic developments, company performance, interest rates, and other factors.',
    'Past performance is not necessarily indicative of future results.',
    'WINTECH does not promise or guarantee fixed returns, assured profits, or protection against investment losses.',
    'Clients should carefully evaluate their financial objectives, investment horizon, and risk tolerance before entering into any investment arrangement.',
    'Investments should be made only under a legally compliant and appropriately authorised arrangement.',
  ],
};

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'What does WINTECH do?',
    a: 'WINTECH focuses on stock market investment opportunities across multiple sectors through research-based investment approaches.',
  },
  {
    q: 'Which sectors does WINTECH cover?',
    a: 'Our research coverage includes banking, IT, healthcare, pharmaceuticals, automobiles, infrastructure, energy, FMCG, metals, telecom, and other sectors.',
  },
  {
    q: 'How does WINTECH charge fees?',
    a: 'Our proposed fee model includes a fixed management fee and a performance-based fee, subject to applicable regulations and the client agreement.',
  },
  {
    q: 'Are investment returns guaranteed?',
    a: 'No. Stock market investments involve risk, and returns are not guaranteed.',
  },
  {
    q: 'How can I become a client?',
    a: 'You can submit an enquiry through our website. Eligibility, applicable disclosures, and documentation will be reviewed before any investment arrangement is entered into.',
  },
  {
    q: 'Can I withdraw my investment?',
    a: 'Withdrawal and settlement conditions will be governed by the applicable investment agreement and regulatory requirements.',
  },
];

export const CONTACT_COPY = {
  heading: "Let's Discuss Your Investment Goals",
  intro:
    'Interested in exploring investment opportunities with WINTECH? Connect with our team to learn more about our investment approach, services, and applicable terms.',
};

export const DISCLAIMER =
  'Investments in securities market are subject to market risks. Read all relevant documents carefully before investing. No return or profit is guaranteed. All services are subject to applicable laws, regulations, registrations, and authorisations.';

export const ENQUIRY_INTERESTS: { value: string; label: string }[] = [
  { value: 'investment', label: 'Investment services' },
  { value: 'fees', label: 'Fees and terms' },
  { value: 'general', label: 'General question' },
  { value: 'partnership', label: 'Business / partnership' },
  { value: 'other', label: 'Something else' },
];

/** Trust strip under the hero. */
export const HIGHLIGHTS: IconItem[] = [
  { icon: Layers, title: '10+ sectors', text: 'researched across the Indian market' },
  { icon: Search, title: '6-step process', text: 'from research to reporting' },
  { icon: ShieldCheck, title: 'Risk-first', text: 'decisions and clear disclosures' },
  { icon: Receipt, title: 'Transparent', text: 'fees agreed before investing' },
];
