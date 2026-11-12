import { expect, test } from 'vitest';
import { match } from '../src/matching.js';

test('normalizes skills and weights only observed factors', () => {
  const result = match(
    { skills: [' react ', 'JAVASCRIPT'] },
    { requiredSkills: ['React', 'JavaScript', 'Node.js'] },
  );
  expect(result.score).toBe(67);
  expect(result.missingSkills).toEqual(['Node.js']);
  expect(result.reasons[0]).toContain('React, JavaScript');
});
test('treats missing profile data as unknown', () => {
  const result = match({}, { requiredSkills: ['React'] });
  expect(result.score).toBeNull();
  expect(result.missingSkills).toEqual([]);
});
test('explains portfolio, interests and remote work', () => {
  const result = match(
    {
      skills: ['React'],
      interests: ['Technology'],
      portfolioProjects: [{ technologies: ['React'] }],
    },
    { requiredSkills: ['React'], industry: 'Technology', workMode: 'remote' },
  );
  expect(result.score).toBe(100);
  expect(result.reasons.join(' ')).toMatch(/industry.*Remote.*Portfolio/);
});
