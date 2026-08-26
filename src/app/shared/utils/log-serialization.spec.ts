import { safeSerialize } from './log-serialization';

describe('safeSerialize', () => {
  const maxDepth = 3;
  const maxStrLen = 50;

  it('returns null for null', () => {
    expect(safeSerialize(null, maxDepth, maxStrLen)).toBeNull();
  });

  it('returns [undefined] for undefined', () => {
    expect(safeSerialize(undefined, maxDepth, maxStrLen)).toBe('[undefined]');
  });

  it('returns primitives unchanged', () => {
    expect(safeSerialize(42, maxDepth, maxStrLen)).toBe(42);
    expect(safeSerialize(true, maxDepth, maxStrLen)).toBe(true);
  });

  it('truncates long strings', () => {
    const long = 'a'.repeat(100);
    const result = safeSerialize(long, maxDepth, maxStrLen) as string;
    expect(result.length).toBeLessThan(100);
    expect(result).toContain('...');
  });

  it('leaves short strings unchanged', () => {
    expect(safeSerialize('hello', maxDepth, maxStrLen)).toBe('hello');
  });

  it('serializes BigInt', () => {
    expect(safeSerialize(BigInt(123), maxDepth, maxStrLen)).toBe('123n');
  });

  it('serializes Symbol', () => {
    expect(safeSerialize(Symbol('test'), maxDepth, maxStrLen)).toBe('Symbol(test)');
  });

  it('serializes functions with name', () => {
    function named() {}
    const result = safeSerialize(named, maxDepth, maxStrLen) as string;
    expect(result).toContain('named');
  });

  it('serializes anonymous functions', () => {
    const result = safeSerialize(() => {}, maxDepth, maxStrLen) as string;
    expect(result).toContain('anonymous');
  });

  it('serializes Error objects', () => {
    const err = new Error('test error');
    const result = safeSerialize(err, maxDepth, maxStrLen) as Record<string, unknown>;
    expect(result['name']).toBe('Error');
    expect(result['message']).toBe('test error');
  });

  it('serializes arrays', () => {
    const result = safeSerialize([1, 'two', true], maxDepth, maxStrLen) as unknown[];
    expect(result).toEqual([1, 'two', true]);
  });

  it('serializes plain objects', () => {
    const result = safeSerialize({ a: 1, b: 'hello' }, maxDepth, maxStrLen) as Record<
      string,
      unknown
    >;
    expect(result['a']).toBe(1);
    expect(result['b']).toBe('hello');
  });

  it('handles circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj['self'] = obj;
    const result = safeSerialize(obj, maxDepth, maxStrLen) as Record<string, unknown>;
    expect(result['a']).toBe(1);
    expect(result['self']).toBe('[Circular]');
  });

  it('enforces depth limit', () => {
    const deep = { a: { b: { c: { d: 'too deep' } } } };
    const result = safeSerialize(deep, 1, maxStrLen) as Record<string, unknown>;
    expect((result['a'] as Record<string, unknown>)['b']).toBe('[Depth limit exceeded]');
  });
});
