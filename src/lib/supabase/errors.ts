import { UserFacingError } from '@/lib/errors';

/**
 * Postgres error codes our SECURITY DEFINER functions raise deliberately with messages written for
 * end users. Anything else (constraint names, SQL, internals) is replaced by a generic message.
 */
const SAFE_PG_CODES = new Set([
  '42501', // insufficient_privilege
  '23514', // check_violation (business rule)
  '22023', // invalid_parameter_value (validation)
  'P0002', // no_data_found
]);

export const GENERIC_SAVE_ERROR = 'The change could not be saved. Nothing was changed. Please try again.';

export function toUserFacingDbError(
  error: { code?: string; message?: string },
  fallback = GENERIC_SAVE_ERROR,
): Error {
  if (error.code && SAFE_PG_CODES.has(error.code) && error.message) return new UserFacingError(error.message);
  return new Error(fallback);
}

/**
 * NUMERIC values are sent to Postgres as decimal strings so no binary floating point is involved.
 * PostgREST accepts strings for numeric parameters; the generated types say `number`, hence the cast.
 */
export function numericParam(value: string): number {
  return value as unknown as number;
}
