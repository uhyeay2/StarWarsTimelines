import { decodeJwt, getTokenExpiration, isTokenExpired } from './jwt';

/** Builds a minimal unsigned JWT with the given payload. */
function makeJwt(payload: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.`;
}

describe('decodeJwt', () => {
  it('decodes the payload of a well-formed token', () => {
    const payload = { sub: 'u1', unique_name: 'luke', role: 'Admin', iat: 1000, exp: 2000 };
    const decoded = decodeJwt(makeJwt(payload));

    expect(decoded).toEqual(payload);
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('')).toBeNull();
  });
});

describe('getTokenExpiration', () => {
  it('converts the exp claim to a Date', () => {
    const expiry = getTokenExpiration(makeJwt({ exp: 1700000000 }));

    expect(expiry).toEqual(new Date(1700000000 * 1000));
  });

  it('returns null when the token cannot be parsed', () => {
    expect(getTokenExpiration('garbage')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it('treats tokens outside the buffer window as valid', () => {
    const token = makeJwt({ exp: nowSeconds() + 3600 });

    expect(isTokenExpired(token)).toBe(false);
  });

  it('treats tokens inside the buffer window as expired', () => {
    const token = makeJwt({ exp: nowSeconds() + 30 });

    expect(isTokenExpired(token, 60)).toBe(true);
    expect(isTokenExpired(token, 10)).toBe(false);
  });

  it('treats already-expired tokens as expired', () => {
    const token = makeJwt({ exp: nowSeconds() - 3600 });

    expect(isTokenExpired(token)).toBe(true);
  });

  it('treats unparseable tokens as expired', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });
});
