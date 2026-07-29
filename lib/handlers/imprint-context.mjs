export function resolveActiveImprintContext({
  defaultImprint = null,
  projectImprints = [],
  projectId = null,
} = {}) {
  const projectImprint = projectId
    ? projectImprints.find((installation) => (
        installation?.project_id === projectId && installation?.imprint
      )) || null
    : null;

  const installation = projectImprint || (defaultImprint?.imprint ? defaultImprint : null);
  if (!installation) return null;

  return {
    installation_id: installation.id || null,
    imprint_id: installation.imprint_id || installation.imprint?.id || null,
    project_id: projectImprint?.project_id || null,
    source: projectImprint ? 'project' : 'default',
    imprint: installation.imprint,
  };
}

export function buildProjectImprintMap(projectImprints = []) {
  if (!Array.isArray(projectImprints)) return {};

  return projectImprints.reduce((map, installation) => {
    if (installation?.project_id && installation?.imprint) {
      map[installation.project_id] = installation.imprint;
    }
    return map;
  }, {});
}
