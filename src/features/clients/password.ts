// Unambiguous characters (no 0/O, 1/l/I) so passwords can be read out or typed reliably.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = LETTERS + DIGITS;

function pick(alphabet: string, random: Uint32Array, i: number): string {
  // 2^32 is not a multiple of the alphabet sizes, but the bias (< 1e-8) is irrelevant here.
  return alphabet[random[i]! % alphabet.length]!;
}

/** Cryptographically random temporary password with at least one letter and one digit. */
export function generateTemporaryPassword(length = 14): string {
  if (length < 10) throw new Error('Temporary passwords must be at least 10 characters.');
  const random = new Uint32Array(length + 2);
  crypto.getRandomValues(random);

  const chars = Array.from({ length }, (_, i) => pick(ALL, random, i));
  // Guarantee the policy: one letter and one digit at random positions.
  const letterPos = random[length]! % length;
  let digitPos = random[length + 1]! % length;
  if (digitPos === letterPos) digitPos = (digitPos + 1) % length;
  chars[letterPos] = pick(LETTERS, random, letterPos);
  chars[digitPos] = pick(DIGITS, random, digitPos);
  return chars.join('');
}
