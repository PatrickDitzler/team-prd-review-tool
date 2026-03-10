import type { EnhancedPBI, AzureConfig, ExportResult } from './types';

// ---------------------------------------------------------------------------
// Core export function
// ---------------------------------------------------------------------------

export async function exportToAzureDevOps(
  pbis: EnhancedPBI[],
  config: AzureConfig,
  prdContext: string,
): Promise<ExportResult> {
  // Demo mode
  if (config.demo) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return {
      success: true,
      message: 'Demo export successful',
      url: 'https://dev.azure.com/demo/project/_workitems/edit/12345',
    };
  }

  const { org, project, pat } = config;
  if (!org || !project || !pat) {
    throw new Error('Missing Azure DevOps configuration (org, project, pat).');
  }

  const baseUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems`;
  const headers = {
    'Content-Type': 'application/json-patch+json',
    Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
  };

  // 1. Create the parent Feature
  const prdTitleMatch = prdContext.match(/^#\s+(.*)/m);
  const featureTitle = prdTitleMatch ? prdTitleMatch[1] : 'New PRD Feature';

  const featurePatch = [
    { op: 'add', path: '/fields/System.Title', value: featureTitle },
    { op: 'add', path: '/fields/System.Description', value: prdContext },
  ];

  const featureRes = await fetch(`${baseUrl}/$Feature?api-version=7.1`, {
    method: 'POST',
    headers,
    body: JSON.stringify(featurePatch),
  });

  if (!featureRes.ok) {
    const errorText = await featureRes.text();
    throw new Error(`Failed to create Feature: ${featureRes.statusText} — ${errorText}`);
  }

  const featureData = await featureRes.json();
  const featureUrl = featureData._links.html.href;

  // 2. Create child PBIs and link them
  for (const pbi of pbis) {
    const pbiDescHTML = `
      <h3>Description</h3>
      <p>${pbi.description.replace(/\n/g, '<br/>')}</p>
      <h3>Functional Requirements</h3>
      <p>${pbi.functionalReqs.replace(/\n/g, '<br/>')}</p>
      <h3>Acceptance Criteria</h3>
      <pre>${pbi.gherkin}</pre>
      <hr/>
      <h3>Swarm Agent Reviews</h3>
      <ul>
        ${pbi.agentReviews.map((r) => `<li><strong>${r.role} (${r.agentName}):</strong> ${r.feedback}</li>`).join('')}
      </ul>
    `;

    const pbiPatch = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: pbi.description.split('\n')[0].substring(0, 100),
      },
      { op: 'add', path: '/fields/System.Description', value: pbiDescHTML },
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: featureData.url,
        },
      },
    ];

    const pbiRes = await fetch(`${baseUrl}/$Product Backlog Item?api-version=7.1`, {
      method: 'POST',
      headers,
      body: JSON.stringify(pbiPatch),
    });

    if (!pbiRes.ok) {
      console.error('Failed to create child PBI. Continuing anyway...', await pbiRes.text());
    }
  }

  return {
    success: true,
    url: featureUrl,
  };
}
