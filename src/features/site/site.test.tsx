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
  });

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
  });

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
