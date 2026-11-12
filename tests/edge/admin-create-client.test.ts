import { describe, expect, it } from 'vitest';
import {
  corsHeaders,
  validateCreateClientInput,
} from '../../supabase/functions/admin-create-client/validation.ts';

const VALID = {
  email: '  Priya.Shah@Example.TEST ',
  fullName: '  Priya   Shah ',
  phone: '+91 98765 43210',
  temporaryPassword: 'Welcome2026x',
};

describe('validateCreateClientInput', () => {
  it('normalises valid input', () => {
    const r = validateCreateClientInput(VALID);
    expect(r).toEqual({
      ok: true,
      value: {
        email: 'priya.shah@example.test',
        fullName: 'Priya Shah',
        phone: '+91 98765 43210',
        temporaryPassword: 'Welcome2026x',
      },
    });
  });

  it('treats an empty phone as null', () => {
    const r = validateCreateClientInput({ ...VALID, phone: '  ' });
    expect(r.ok && r.value.phone).toBeNull();
  });

  it('reports field errors', () => {
    const r = validateCreateClientInput({
      email: 'nope',
      fullName: 'A',
      phone: 'abc',
      temporaryPassword: 'short',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['email', 'fullName', 'phone', 'temporaryPassword']);
    }
  });

  it('requires letters and numbers in the temporary password', () => {
    const r = validateCreateClientInput({ ...VALID, temporaryPassword: 'onlyletterspass' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.temporaryPassword).toMatch(/letter and one number/);
  });

  it('rejects unexpected fields such as role', () => {
    const r = validateCreateClientInput({ ...VALID, role: 'admin' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toMatch(/Unexpected field/);
  });

  it('handles non-object bodies', () => {
    expect(validateCreateClientInput(null).ok).toBe(false);
    expect(validateCreateClientInput('x').ok).toBe(false);
  });
});

describe('corsHeaders', () => {
  const allowed = ['http://localhost:5173'];

  it('echoes allowed origins only', () => {
    expect(corsHeaders('http://localhost:5173', allowed)['Access-Control-Allow-Origin']).toBe(
      'http://localhost:5173',
    );
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeaders(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
