import type {
  ModelCapability,
  ModelDefinition,
  ProviderPrivacyPolicy,
  RoutingRequest,
} from "./contracts";

export interface RoutingDecision {
  primary: ModelDefinition;
  secondary?: ModelDefinition;
  adjudicator?: ModelDefinition;
  reasons: string[];
}

function hasCapabilities(model: ModelDefinition, required: ModelCapability[]): boolean {
  return required.every((capability) => model.capabilities.includes(capability));
}

function privacyAllows(
  model: ModelDefinition,
  policies: ProviderPrivacyPolicy[],
  unpublished: boolean,
): boolean {
  const policy = policies.find((item) => item.provider === model.provider);
  if (!policy || !policy.gdprReviewed || !policy.dpaAvailable) return false;
  if (unpublished && !policy.allowedForUnpublishedManuscripts) return false;
  return true;
}

function scoreCandidate(model: ModelDefinition, request: RoutingRequest): number {
  let score = 0;
  if (model.benchmarkStatus === "approved") score += 100;
  if (model.benchmarkStatus === "candidate") score += 30;
  if (request.preferredProvider === model.provider) score += 15;
  if (request.serviceLevel === "correzione-bozze" && model.capabilities.includes("proofreading")) score += 30;
  if (request.serviceLevel === "revisione-linguistica" && model.capabilities.includes("grammar")) score += 25;
  if (request.serviceLevel === "editing-stilistico" && model.capabilities.includes("stylistic-editing")) score += 35;
  if (request.serviceLevel === "editing-narrativo" && model.capabilities.includes("narrative-analysis")) score += 40;
  if (request.reviewMode === "premium" && model.premium) score += 10;
  return score;
}

/**
 * Router puro: non chiama provider e non conosce segreti. Le definizioni modello
 * e le policy privacy sono configurazione server-side. Un modello non passa mai
 * il routing se la policy del provider non e stata verificata per il tipo di Job.
 */
export function routeEditorialJob(
  request: RoutingRequest,
  models: ModelDefinition[],
  policies: ProviderPrivacyPolicy[],
): RoutingDecision {
  const candidates = models
    .filter((model) => model.enabled)
    .filter((model) => model.benchmarkStatus !== "rejected")
    .filter((model) => hasCapabilities(model, request.requiredCapabilities))
    .filter((model) => privacyAllows(model, policies, request.unpublishedManuscript))
    .sort((a, b) => scoreCandidate(b, request) - scoreCandidate(a, request));

  const primary = candidates[0];
  if (!primary) {
    throw new Error("Nessun modello ammesso soddisfa capacita e requisiti privacy del Job.");
  }

  const reasons = [
    `primary:${primary.id}`,
    `service:${request.serviceLevel}`,
    `review:${request.reviewMode}`,
    `benchmark:${primary.benchmarkStatus}`,
  ];

  if (request.reviewMode !== "premium") return { primary, reasons };

  const secondary = candidates.find((model) => model.id !== primary.id && model.provider !== primary.provider)
    ?? candidates.find((model) => model.id !== primary.id);
  const adjudicator = candidates.find(
    (model) => model.capabilities.includes("adjudication") && model.id !== secondary?.id,
  );

  if (!secondary) reasons.push("warning:no-independent-secondary");
  if (!adjudicator) reasons.push("warning:no-adjudicator");

  return { primary, secondary, adjudicator, reasons };
}
