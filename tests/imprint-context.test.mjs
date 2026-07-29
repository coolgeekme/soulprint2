import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveImprintContext, buildProjectImprintMap } from '../lib/handlers/imprint-context.mjs';

test('returns null when no imprints are installed', () => {
  const result = resolveActiveImprintContext({
    defaultImprint: null,
    projectImprints: [],
    projectId: null,
  });
  assert.equal(result, null);
});

test('returns default imprint when no project context', () => {
  const result = resolveActiveImprintContext({
    defaultImprint: {
      id: 'install-1',
      imprint_id: 'imp-1',
      usage_type: 'default',
      imprint: { id: 'imp-1', name: 'Business Coach' },
    },
    projectImprints: [],
    projectId: null,
  });
  assert.equal(result.source, 'default');
  assert.equal(result.imprint.name, 'Business Coach');
});

test('returns project-specific imprint when project_id matches', () => {
  const result = resolveActiveImprintContext({
    defaultImprint: {
      id: 'install-1',
      imprint_id: 'imp-1',
      usage_type: 'default',
      imprint: { id: 'imp-1', name: 'Business Coach' },
    },
    projectImprints: [
      {
        id: 'install-2',
        imprint_id: 'imp-2',
        usage_type: 'project',
        project_id: 'proj-123',
        imprint: { id: 'imp-2', name: 'Code Vibe Guru' },
      },
    ],
    projectId: 'proj-123',
  });
  assert.equal(result.source, 'project');
  assert.equal(result.project_id, 'proj-123');
  assert.equal(result.imprint.name, 'Code Vibe Guru');
});

test('builds a project-to-imprint map for UI display', () => {
  const map = buildProjectImprintMap([
    {
      id: 'install-1',
      project_id: 'proj-a',
      imprint: { id: 'imp-1', name: 'Marketing Guru', icon: '📣' },
    },
    {
      id: 'install-2',
      project_id: 'proj-b',
      imprint: { id: 'imp-2', name: 'Code Reviewer', icon: '🔍' },
    },
  ]);
  assert.equal(map['proj-a'].name, 'Marketing Guru');
  assert.equal(map['proj-b'].name, 'Code Reviewer');
  assert.equal(Object.keys(map).length, 2);
});
