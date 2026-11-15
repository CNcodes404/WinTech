import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasOp, makeProfile, mockQuery, mockSignedIn, supabaseMock } from '../../../tests/mocks/supabase';
import { renderRoute } from '../../../tests/utils';

describe('public website', () => {
  it('shows every section of the company content at the home page, with a client login', async () => {
    renderRoute('/');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Building Wealth through smarter investment decisions/i,
      }),
    ).toBeInTheDocument();
    for (const id of [
      'home',
      'about',
      'sectors',
      'approach',
      'how-it-works',
      'fees',
      'risk',
      'faq',
      'contact',
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByRole('heading', { name: 'Who We Are' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Telecom & Communication' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Settlement & Withdrawal/ })).toBeInTheDocument();
    expect(screen.getByText(/No fixed or guaranteed investment return is promised/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Client login/ })[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Get started/ })).toHaveAttribute('href', '#contact');
    // Contact details are hidden until the owner fills them in.
    expect(screen.queryByText(/\[Your Official Email/)).toBeNull();
  });

  it('opens FAQ answers', async () => {
    const { user } = renderRoute('/');
    const q = await screen.findByText('Are investment returns guaranteed?');
    await user.click(q);
    expect(screen.getByText(/returns are not guaranteed/)).toBeVisible();
  });

  it('validates and sends an enquiry (honeypot empty, consent required)', async () => {
    const { user } = renderRoute('/');
    const form = (await screen.findByRole('heading', { name: 'Send us an enquiry' })).parentElement!;
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }));
    expect(await within(form).findByText('Please enter your name.')).toBeInTheDocument();
    expect(within(form).getByText(/Please agree so that we can respond/)).toBeInTheDocument();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText(/Full name/), 'Priya (fictional)');
    await user.type(within(form).getByLabelText(/^Email/), 'priya@example.test');
    await user.type(within(form).getByLabelText(/^Phone/), '+91 98765 43210');
    await user.selectOptions(within(form).getByLabelText(/interested in/), 'fees');
    await user.type(within(form).getByLabelText(/Your message/), 'Please explain the fee structure.');
    await user.click(within(form).getByRole('checkbox'));
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('submit_enquiry', {
        p_full_name: 'Priya (fictional)',
        p_email: 'priya@example.test',
        p_phone: '+91 98765 43210',
        p_city: '',
        p_interest: 'fees',
        p_message: 'Please explain the fee structure.',
        p_consent: true,
        p_website: '',
      }),
    );
    expect(await screen.findByText(/we have received your enquiry/)).toBeInTheDocument();
  }, 20_000);

  it('shows the server message when the daily limit is reached', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23514',
        message: 'We have already received your enquiries today. Our team will get back to you.',
      },
    });
    const { user } = renderRoute('/');
    const form = (await screen.findByRole('heading', { name: 'Send us an enquiry' })).parentElement!;
    await user.type(within(form).getByLabelText(/Full name/), 'Priya');
    await user.type(within(form).getByLabelText(/^Email/), 'priya@example.test');
    await user.type(within(form).getByLabelText(/Your message/), 'Another question for you.');
    await user.click(within(form).getByRole('checkbox'));
    await user.click(within(form).getByRole('button', { name: 'Send enquiry' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('already received your enquiries today');
  }, 20_000);

  it('serves the draft privacy and terms pages', async () => {
    const { unmount } = renderRoute('/privacy');
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Draft for review/)).toBeInTheDocument();
    unmount();
    renderRoute('/terms');
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument();
    expect(screen.getByText(/governed by the laws of India/)).toBeInTheDocument();
  });

  it('offers signed-in users a link back to their dashboard', async () => {
    mockSignedIn(makeProfile({ role: 'client' }));
    renderRoute('/');
    expect((await screen.findAllByRole('link', { name: /Go to dashboard/ }))[0]).toHaveAttribute(
      'href',
      '/client/overview',
    );
  });
});

describe('admin enquiries page', () => {
  const ENQ = {
    id: '00000000-0000-4000-8000-0000000000e9',
    full_name: 'Priya (fictional)',
    email: 'priya@example.test',
    phone: '+91 98765 43210',
    city: 'Pune',
    interest: 'investment',
    message: 'I would like to know more.',
    status: 'new',
    admin_note: null,
    created_at: '2026-11-15T05:00:00Z',
    updated_at: '2026-11-15T05:00:00Z',
  };

  beforeEach(() => {
    mockSignedIn(makeProfile({ role: 'admin' }));
    mockQuery((table, ops) =>
      table === 'enquiries' && hasOp(ops, 'select') ? { data: [ENQ], error: null } : undefined,
    );
  });

  it('lists enquiries and updates the status with a note', async () => {
    const { user } = renderRoute('/admin/enquiries');
    expect(await screen.findByText('I would like to know more.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /priya@example.test/ })).toHaveAttribute(
      'href',
      'mailto:priya@example.test',
    );
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    const dialog = await screen.findByRole('dialog', { name: /Update enquiry from Priya/ });
    expect(within(dialog).getByLabelText('Status')).toHaveValue('contacted');
    await user.type(within(dialog).getByLabelText(/Note/), 'Called back');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('admin_set_enquiry_status', {
        p_enquiry_id: ENQ.id,
        p_status: 'contacted',
        p_note: 'Called back',
      }),
    );
  });
});

describe('performance section (illustrative mock data)', () => {
  it('compounds cycle returns exactly and the growth line ends at the summary value', async () => {
    const { GROWTH, STRATEGIES, summarise, START_VALUE } = await import('./performance');
    const prime = summarise(STRATEGIES[0]!);
    const expert = summarise(STRATEGIES[1]!);
    // Prime: 1.485 × 1.213 − 1 = 80.13%; Expert: 1.074 × 1.198 × 1.146 × 0.968 × 1.119 − 1 = 59.72%.
    expect(prime.totalReturn).toBeCloseTo(0.801305, 6);
    expect(expert.totalReturn).toBeCloseTo(0.59717, 4);
    expect(prime.cagr).toBeCloseTo(0.1249, 3);
    expect(GROWTH).toHaveLength(61);
    expect(GROWTH[0]).toMatchObject({ label: 'Nov 2021', prime: START_VALUE, expert: START_VALUE });
    expect(GROWTH.at(-1)!.label).toBe('Nov 2026');
    expect(Math.abs(GROWTH.at(-1)!.prime - prime.endValue)).toBeLessThanOrEqual(1);
    expect(Math.abs(GROWTH.at(-1)!.expert - expert.endValue)).toBeLessThanOrEqual(1);
    expect([prime.completedCycles, expert.completedCycles]).toEqual([1, 5]);
  });

  it('shows both strategies, a clear mock-data notice and switchable views', async () => {
    const { user } = renderRoute('/');
    const section = await waitFor(() => {
      const el = document.getElementById('performance');
      if (!el) throw new Error('missing');
      return el;
    });
    const s = within(section);
    expect(s.getByRole('heading', { name: 'WINTECH Prime' })).toBeInTheDocument();
    expect(s.getByRole('heading', { name: 'WINTECH Expert' })).toBeInTheDocument();
    expect(s.getByText('3-year cycle')).toBeInTheDocument();
    expect(s.getByText('1-year cycle')).toBeInTheDocument();
    expect(s.getByText('+80.1%')).toBeInTheDocument();
    expect(s.getByText('+59.7%')).toBeInTheDocument();
    expect(s.getByRole('note')).toHaveTextContent('Illustrative mock data.');
    expect(s.getByText(/not actual or projected returns of any WINTECH strategy/)).toBeInTheDocument();
    expect(
      await s.findByRole('img', { name: /Growth of ₹1,00,000 from Nov 2021 to Nov 2026/ }),
    ).toBeInTheDocument();

    await user.click(s.getByRole('button', { name: /Return per cycle/ }));
    expect(await s.findByRole('img', { name: /WINTECH Expert return per cycle/ })).toBeInTheDocument();

    await user.click(s.getByRole('button', { name: /View as table/ }));
    const cycles = s.getByRole('table', { name: /Return per cycle/ });
    expect(within(cycles).getByText('-3.2%')).toBeInTheDocument();
    expect(within(cycles).getByText(/Dec 2024 – Nov 2027 \(in progress\)/)).toBeInTheDocument();
  });
});
