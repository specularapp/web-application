import type { OpportunityFormInput } from "./schemas";
import type { Opportunity } from "./summary";
import type { CrmFunnel } from "./tree";

export function opportunityFormValues(
  item: Opportunity,
  funnels: CrmFunnel[],
): OpportunityFormInput {
  const attribution = item.attribution;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    funnelId:
      funnels.find((funnel) => funnel.reference === item.funnel?.reference)
        ?.id ?? null,
    clientId: item.client.reference ? item.client.id : null,
    clientName: item.client.name,
    clientCompany: item.client.company ?? "",
    contactName: item.contact?.name ?? "",
    contactEmail: item.contact?.email ?? "",
    contactPhone: item.contact?.phone ?? "",
    stage: item.stage,
    value: item.value,
    probability: item.probability,
    temperature: item.temperature,
    city: item.city ?? "",
    state: item.state ?? "",
    expectedAt: item.expectedAt ?? "",
    ownerId: item.owner.id || null,
    peopleIds: item.people.map((person) => person.id).filter(Boolean),
    tags: item.tags,
    source: item.source,
    partnerCode: item.partnerCode ?? "",
    lastTouchAt: item.lastTouchAt ?? "",
    nextStepLabel: item.nextStep?.label ?? "",
    nextStepAt: item.nextStep?.at ?? "",
    firstResponseMinutes: item.firstResponseMinutes ?? null,
    averageResponseMinutes: item.averageResponseMinutes ?? null,
    attribution: {
      campaign: attribution?.campaign ?? "",
      adSet: attribution?.adSet ?? "",
      ad: attribution?.ad ?? "",
      gclid: attribution?.gclid ?? "",
      ctwaclid: attribution?.ctwaclid ?? "",
      fbclid: attribution?.fbclid ?? "",
      sourceId: attribution?.sourceId ?? "",
      metaLeadId: attribution?.metaLeadId ?? "",
      sourceUrl: attribution?.sourceUrl ?? "",
      utm: {
        source: attribution?.utm?.source ?? "",
        medium: attribution?.utm?.medium ?? "",
        campaign: attribution?.utm?.campaign ?? "",
        content: attribution?.utm?.content ?? "",
        term: attribution?.utm?.term ?? "",
      },
    },
  };
}
