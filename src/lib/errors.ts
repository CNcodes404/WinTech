/**
 * An error whose message is safe to show to the user verbatim.
 * Anything else (database errors, network errors, stack traces) must be replaced by a generic,
 * user-friendly message before it reaches the UI.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
