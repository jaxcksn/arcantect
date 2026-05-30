import type { RawEdge, RawNode, ScorerEdge, ScorerNode, FlowType } from './types.ts'

// ---------------------------------------------------------------------------
// Rune-type classification sets
// Ordered from most specific to least so inference rules are unambiguous.
// ---------------------------------------------------------------------------

export const PUBLIC_TYPES = new Set(['cdn', 'load_balancer', 'api_gateway', 'waf', 'dns', 'internet', 'payment_processor', 'firewall', 'vpn', 'application'])
export const DMZ_TYPES = new Set(['compute', 'serverless', 'auth', 'orchestrator', 'identity_provider', 'foundation_model', 'ml_platform', 'container', 'kubernetes'])
export const PRIVATE_TYPES = new Set(['cache', 'queue', 'private_network', 'event_bus', 'streaming', 'monitoring', 'log_aggregator', 'tracing', 'metrics', 'alerting'])
export const DATA_TYPES = new Set(['database', 'object_storage', 'nosql_database', 'secrets_manager', 'search', 'static_assets'])

export const INGRESS_TYPES = new Set(['cdn', 'load_balancer', 'api_gateway', 'internet'])
export const AUTH_TYPES = new Set(['api_gateway', 'waf', 'auth'])
export const DATABASE_TYPES = new Set(['database', 'nosql_database', 'search'])
export const STORAGE_TYPES = new Set(['object_storage'])
export const QUEUE_TYPES = new Set(['queue', 'event_bus', 'streaming'])
export const DNS_TYPES = new Set(['dns'])
export const CACHE_TYPES = new Set(['cache'])

// ---------------------------------------------------------------------------
// FlowType inference from rune types at each end of an edge
// ---------------------------------------------------------------------------

function inferFlowType(sourceType: string, targetType: string): FlowType {
  if (DNS_TYPES.has(sourceType)) return 'dns-resolution'
  if (DATABASE_TYPES.has(targetType) || CACHE_TYPES.has(targetType)) return 'db-query'
  if (QUEUE_TYPES.has(targetType)) return 'event'
  if (STORAGE_TYPES.has(targetType)) return 'file-io'
  if (PUBLIC_TYPES.has(sourceType) && DMZ_TYPES.has(targetType)) return 'user-request'
  if (PUBLIC_TYPES.has(sourceType)) return 'https-request'
  return 'internal-rpc'
}

// Edges from public-facing rune types carry encrypted traffic by default.
function inferEncrypted(sourceType: string): boolean {
  return PUBLIC_TYPES.has(sourceType)
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function normalizeNodes(rawNodes: readonly RawNode[]): ScorerNode[] {
  return rawNodes.map(node => {
    const runeType = String(node.data['nodeType'] ?? '')
    // Anything in data beyond nodeType is treated as per-node config.
    const config: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node.data)) {
      if (key !== 'nodeType') config[key] = value
    }
    return {
      id: node.id,
      runeType,
      label: runeType,
      config,
      capabilities: node.capabilities ?? [],
      tradeoffs: node.tradeoffs,
    }
  })
}

export function normalizeEdges(
  rawEdges: readonly RawEdge[],
  nodes: readonly ScorerNode[],
): ScorerEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  return rawEdges.map(edge => {
    const sourceType = nodeMap.get(edge.source)?.runeType ?? ''
    const targetType = nodeMap.get(edge.target)?.runeType ?? ''
    const configEncrypted = edge.data?.['encrypted']

    const direction =
      edge.data?.direction === 'applies' ? 'applies' :
      edge.data?.direction === 'hosts'   ? 'hosts'   : 'directed'

    const isHosts = direction === 'hosts'

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      direction,
      flowType: isHosts ? 'deployment' : inferFlowType(sourceType, targetType),
      encrypted: isHosts ? false : (configEncrypted === true ? true : inferEncrypted(sourceType)),
    }
  })
}
