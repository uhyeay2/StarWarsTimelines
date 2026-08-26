import { ROUTES } from './routes.constants';

describe('ROUTES', () => {
  it('contains all expected route keys', () => {
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.TIMELINE).toBe('/timeline');
    expect(ROUTES.LOGIN).toBe('/login');
    expect(ROUTES.REGISTER).toBe('/register');
    expect(ROUTES.VERIFY_EMAIL).toBe('/verify-email');
    expect(ROUTES.LIBRARY).toBe('/library');
    expect(ROUTES.LIBRARY_TRACKED).toBe('/library/tracked');
    expect(ROUTES.LIBRARY_WISH_LIST).toBe('/library/wish-list');
    expect(ROUTES.LIBRARY_TIMELINE).toBe('/library/timeline');
    expect(ROUTES.SETTINGS).toBe('/settings');
    expect(ROUTES.CATALOG).toBe('/catalog');
  });

  it('has 11 route entries', () => {
    expect(Object.keys(ROUTES)).toHaveLength(11);
  });
});
