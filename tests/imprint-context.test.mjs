import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectImprintMap,
  resolveActiveImprintContext,
} from '../lib/handlers/imprint-context.mjs';

const globalInstallation = {
  id: 'install-global',
  imprint_id: 'imprint-global',
  usage_type: 'default',
  imprint: { id: 'imprint-global', name: 'Global Guide', icon: '🌎' },
};

const projectInstallation = {
  id: 'install-project',
  imprint_id: 'imprint-project',
  usage_type: 'project',
  project_id: 'project-1',
  imprint: { id: 'imprint-project', name: 'Project Coach', icon: '🎯' },
};

test('project imprint overrides the global default inside its project', () => {
  const active = resolveActiveImprintContext({
    defaultImprint: globalInstallation,
    projectImprints: [projectInstallation],
    projectId: 'project-1',
  });

  assert.equal(active.source, 'project');
  assert.equal(active.project_id, 'project-1');
  assert.equal(active.imprint.name, 'Project Coach');
});

test('global default remains active when a project has no assignment', () => {
  const active = resolveActiveImprintContext({
    defaultImprint: globalInstallation,
    projectImprints: [projectInstallation],
    projectId: 'project-2',
  });

  assert.equal(active.source, 'default');
  assert.equal(active.project_id, null);
  assert.equal(active.imprint.name, 'Global Guide');
});

test('no assignment returns no active imprint', () => {
  assert.equal(resolveActiveImprintContext({ projectId: 'project-1' }), null);
});

test('project map retains full imprint display data', () => {
  const map = buildProjectImprintMap([
    projectInstallation,
    { project_id: null, imprint: { name: 'Ignored' } },
    { project_id: 'project-2', imprint: null },
  ]);

  assert.deepEqual(map, {
    'project-1': { id: 'imprint-project', name: 'Project Coach', icon: '🎯' },
  });
});
