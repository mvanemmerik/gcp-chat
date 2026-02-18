import { ServicesClient } from '@google-cloud/run';
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import { SchemaType } from '@google-cloud/vertexai';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT!;
const LOCATION = process.env.VERTEX_AI_LOCATION ?? 'us-east1';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function authenticatedGet(url: string): Promise<unknown> {
  const client = await auth.getClient();
  const res = await client.request({ url, method: 'GET' });
  return res.data;
}

// ── Tool implementations ──────────────────────────────────────────────────────

export async function listCloudRunServices(): Promise<string> {
  try {
    const client = new ServicesClient();
    const [services] = await client.listServices({
      parent: `projects/${PROJECT}/locations/${LOCATION}`,
    });
    if (!services.length) return 'No Cloud Run services found.';
    return services.map(s => {
      const name = s.name?.split('/').pop();
      const url = s.uri ?? 'no URL';
      const traffic = s.traffic?.map(t => `${t.percent}% → ${t.revision?.split('/').pop() ?? 'latest'}`).join(', ') ?? '';
      return `• ${name} — ${url}${traffic ? ` (${traffic})` : ''}`;
    }).join('\n');
  } catch (e: unknown) {
    return `Error listing Cloud Run services: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function listGCSBuckets(): Promise<string> {
  try {
    const storage = new Storage({ projectId: PROJECT });
    const [buckets] = await storage.getBuckets();
    if (!buckets.length) return 'No GCS buckets found.';
    return buckets.map(b => `• ${b.name} (${b.metadata.location ?? 'unknown location'})`).join('\n');
  } catch (e: unknown) {
    return `Error listing GCS buckets: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function listFirestoreCollections(): Promise<string> {
  try {
    const db = new Firestore({ projectId: PROJECT });
    const collections = await db.listCollections();
    if (!collections.length) return 'No Firestore collections found.';
    return collections.map(c => `• ${c.id}`).join('\n');
  } catch (e: unknown) {
    return `Error listing Firestore collections: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function listVMs(): Promise<string> {
  try {
    const url = `https://compute.googleapis.com/compute/v1/projects/${PROJECT}/aggregated/instances`;
    const data = await authenticatedGet(url) as { items?: Record<string, { instances?: Array<{ name: string; status: string; zone: string }> }> };
    const instances: string[] = [];
    for (const zone of Object.values(data.items ?? {})) {
      for (const vm of zone.instances ?? []) {
        instances.push(`• ${vm.name} — ${vm.status} (${vm.zone.split('/').pop()})`);
      }
    }
    return instances.length ? instances.join('\n') : 'No Compute Engine VMs found.';
  } catch (e: unknown) {
    return `Error listing VMs: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function getProjectInfo(): Promise<string> {
  try {
    const url = `https://cloudresourcemanager.googleapis.com/v3/projects/${PROJECT}`;
    const data = await authenticatedGet(url) as { displayName?: string; projectId?: string; projectNumber?: string; state?: string; createTime?: string };
    return [
      `• Project ID: ${data.projectId}`,
      `• Display name: ${data.displayName}`,
      `• Project number: ${data.projectNumber}`,
      `• State: ${data.state}`,
      `• Created: ${data.createTime}`,
    ].join('\n');
  } catch (e: unknown) {
    return `Error getting project info: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function listEnabledAPIs(): Promise<string> {
  try {
    const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services?filter=state:ENABLED&pageSize=100`;
    const data = await authenticatedGet(url) as { services?: Array<{ name: string }> };
    const apis = (data.services ?? []).map(s => `• ${s.name.split('/').pop()}`);
    return apis.length ? apis.join('\n') : 'No enabled APIs found.';
  } catch (e: unknown) {
    return `Error listing enabled APIs: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function getIAMPolicy(): Promise<string> {
  try {
    const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`;
    const client = await auth.getClient();
    const res = await client.request({ url, method: 'POST', data: {} });
    const data = res.data as { bindings?: Array<{ role: string; members: string[] }> };
    const bindings = (data.bindings ?? [])
      .filter(b => !b.role.includes('serviceAgent'))
      .map(b => `• ${b.role}\n  ${b.members.join(', ')}`);
    return bindings.length ? bindings.join('\n') : 'No IAM bindings found.';
  } catch (e: unknown) {
    return `Error getting IAM policy: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function getGCPCosts(): Promise<string> {
  try {
    // Get billing account linked to the project
    const billingInfo = await authenticatedGet(
      `https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`
    ) as { billingAccountName?: string; billingEnabled?: boolean };

    if (!billingInfo.billingEnabled) return 'Billing is not enabled on this project.';

    const billingAccount = billingInfo.billingAccountName; // e.g. billingAccounts/01AEC3-xxx

    // Get budgets (includes actual spend for current period)
    const budgets = await authenticatedGet(
      `https://billingbudgets.googleapis.com/v1/${billingAccount}/budgets`
    ) as { budgets?: Array<{
      displayName?: string;
      amount?: { specifiedAmount?: { units?: string; nanos?: number }; lastPeriodAmount?: object };
      budgetFilter?: { projects?: string[] };
      currentSpend?: { units?: string; nanos?: number };
    }> };

    const lines: string[] = [`Billing account: ${billingAccount}`];

    if (budgets.budgets?.length) {
      lines.push('\nBudgets & current spend:');
      for (const b of budgets.budgets) {
        const name = b.displayName ?? 'Unnamed budget';
        const spend = b.currentSpend;
        const spendAmt = spend
          ? `$${(Number(spend.units ?? 0) + (spend.nanos ?? 0) / 1e9).toFixed(2)}`
          : 'unknown';
        const budgetAmt = b.amount?.specifiedAmount
          ? `$${Number(b.amount.specifiedAmount.units ?? 0).toFixed(2)}`
          : b.amount?.lastPeriodAmount ? 'last period amount' : 'unknown';
        lines.push(`• ${name}: ${spendAmt} spent of ${budgetAmt} budget`);
      }
    } else {
      lines.push('\nNo budgets configured. Set up a budget in the GCP console to track spend.');
    }

    return lines.join('\n');
  } catch (e: unknown) {
    return `Error fetching cost data: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────

type ToolName = 'listCloudRunServices' | 'listGCSBuckets' | 'listFirestoreCollections' | 'listVMs' | 'getProjectInfo' | 'listEnabledAPIs' | 'getIAMPolicy' | 'getGCPCosts';

export async function executeTool(name: string, _args: Record<string, unknown>): Promise<string> {
  const handlers: Record<ToolName, () => Promise<string>> = {
    listCloudRunServices,
    listGCSBuckets,
    listFirestoreCollections,
    listVMs,
    getProjectInfo,
    listEnabledAPIs,
    getIAMPolicy,
    getGCPCosts,
  };
  const handler = handlers[name as ToolName];
  if (!handler) return `Unknown tool: ${name}`;
  return handler();
}

// ── Gemini tool declarations ──────────────────────────────────────────────────

// Use the string literal cast to avoid a runtime dependency on the SchemaType enum
// (the enum value for OBJECT is simply 'OBJECT').
const OBJECT_TYPE = 'OBJECT' as SchemaType;

export const GCP_TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'listCloudRunServices',
      description: 'List all Cloud Run services in the GCP project, including their URLs and traffic routing.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'listGCSBuckets',
      description: 'List all Google Cloud Storage buckets in the GCP project.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'listFirestoreCollections',
      description: 'List all top-level Firestore collections in the GCP project.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'listVMs',
      description: 'List all Compute Engine virtual machine instances across all zones.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'getProjectInfo',
      description: 'Get basic information about the GCP project: name, number, state, creation date.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'listEnabledAPIs',
      description: 'List all enabled Google Cloud APIs on the project.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'getIAMPolicy',
      description: 'Get the IAM policy for the GCP project, showing all role bindings.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
    {
      name: 'getGCPCosts',
      description: 'Get GCP billing information including the billing account and any configured budgets with their current spend.',
      parameters: { type: OBJECT_TYPE, properties: {} },
    },
  ],
};
