import { databaseUrl } from './prisma.service';

describe('databaseUrl', () => {
  const base = 'postgresql://u:p@localhost:5432/db';

  it('throws when DATABASE_URL is missing', () => {
    expect(() => databaseUrl({})).toThrow('DATABASE_URL is not set');
  });

  it('defaults the pool size to 10', () => {
    expect(new URL(databaseUrl({ DATABASE_URL: base })).searchParams.get('connection_limit')).toBe(
      '10',
    );
  });

  it('uses DATABASE_POOL_SIZE when set', () => {
    const url = databaseUrl({ DATABASE_URL: base, DATABASE_POOL_SIZE: '25' });
    expect(new URL(url).searchParams.get('connection_limit')).toBe('25');
  });

  it('keeps an explicit connection_limit from the URL', () => {
    const url = databaseUrl({
      DATABASE_URL: `${base}?connection_limit=3`,
      DATABASE_POOL_SIZE: '25',
    });
    expect(new URL(url).searchParams.get('connection_limit')).toBe('3');
  });
});
