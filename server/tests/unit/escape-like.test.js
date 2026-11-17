import { describe, expect, it } from 'vitest';
import { escapeLike } from '../../src/issues/repository.js';

describe('escapeLike', () => {
  it('leaves ordinary text unchanged', () => {
    expect(escapeLike('Missing consent form')).toBe('Missing consent form');
  });

  it('escapes the LIKE wildcards % and _', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('visit_week')).toBe('visit\\_week');
  });

  it('escapes the escape character itself', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeLike('%_%')).toBe('\\%\\_\\%');
  });
});
