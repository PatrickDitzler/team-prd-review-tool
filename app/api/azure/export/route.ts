import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pbis, config, prdContext } = body;

    // Handle Mock/Demo Mode
    if (config?.demo) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return NextResponse.json({ 
        success: true, 
        message: 'Demo export successful',
        url: 'https://dev.azure.com/demo/project/_workitems/edit/12345'
      });
    }

    const { org, project, pat } = config;
    if (!org || !project || !pat) {
      return NextResponse.json({ error: 'Missing Azure DevOps configuration' }, { status: 400 });
    }

    const baseUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems`;
    const headers = {
      'Content-Type': 'application/json-patch+json',
      'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
    };

    // 1. Create the parent Feature (based on the PRD)
    // We try to extract a title from the PRD, or just use a generic one
    const prdTitleMatch = prdContext.match(/^#\s+(.*)/m);
    const featureTitle = prdTitleMatch ? prdTitleMatch[1] : 'New PRD Feature';

    const featurePatch = [
      { op: "add", path: "/fields/System.Title", value: featureTitle },
      { op: "add", path: "/fields/System.Description", value: prdContext }
    ];

    const featureRes = await fetch(`${baseUrl}/$Feature?api-version=7.1`, {
      method: 'POST',
      headers,
      body: JSON.stringify(featurePatch)
    });

    if (!featureRes.ok) {
      const errorText = await featureRes.text();
      console.error("Failed to create Feature:", errorText);
      return NextResponse.json({ error: `Failed to create Feature: ${featureRes.statusText}` }, { status: featureRes.status });
    }

    const featureData = await featureRes.json();
    const featureId = featureData.id;
    const featureUrl = featureData._links.html.href;

    // 2. Create the child PBIs and link them
    for (const pbi of pbis) {
      // Format the PBI description nicely
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
          ${pbi.agentReviews.map((r: any) => `<li><strong>${r.role} (${r.agentName}):</strong> ${r.feedback}</li>`).join('')}
        </ul>
      `;

      const pbiPatch = [
        { op: "add", path: "/fields/System.Title", value: pbi.description.split('\n')[0].substring(0, 100) },
        { op: "add", path: "/fields/System.Description", value: pbiDescHTML },
        { 
          op: "add", 
          path: "/relations/-", 
          value: {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: featureData.url // The REST API URL of the parent feature
          }
        }
      ];

      const pbiRes = await fetch(`${baseUrl}/$Product Backlog Item?api-version=7.1`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pbiPatch)
      });

      if (!pbiRes.ok) {
          console.error("Failed to create child PBI. Continuing anyway...", await pbiRes.text());
      }
    }

    return NextResponse.json({ 
      success: true, 
      url: featureUrl 
    });

  } catch (error: any) {
    console.error("Azure Export Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to export to Azure' }, { status: 500 });
  }
}
