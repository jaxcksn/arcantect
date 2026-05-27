import {
  IconApi,
  IconBucket,
  IconCertificate,
  IconCloudNetwork,
  IconCreditCard,
  IconDatabase,
  IconFingerprint,
  IconKey,
  IconScale,
  IconServer,
  IconLambda,
  IconShieldCheck,
  IconStack,
  IconTopologyFull,
  IconWorld,
  IconAlignBoxCenterMiddle,
  IconLicense,
} from '@tabler/icons-react';

export type NodeDef = {
  id: string;
  label: string;
  category: Category;
  Icon: React.ComponentType<{ color?: string; strokeWidth?: number }>;
  /** When set, dragging an edge from this node defaults to this edge type. */
  defaultEdgeType?: 'applies';
};

export const CATEGORIES = [
  'Input',
  'Compute',
  'Storage',
  'Network',
  'Security',
  'Messaging',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const NODE_REGISTRY: Record<string, NodeDef> = {
  internet: {
    id: 'internet',
    label: 'Internet',
    category: 'Input',
    Icon: IconWorld,
  },
  compute: {
    id: 'compute',
    label: 'Server',
    category: 'Compute',
    Icon: IconServer,
  },
  serverless: {
    id: 'serverless',
    label: 'Serverless Function',
    category: 'Compute',
    Icon: IconLambda,
  },
  object_storage: {
    id: 'object_storage',
    label: 'Object Storage',
    category: 'Storage',
    Icon: IconBucket,
  },
  database: {
    id: 'database',
    label: 'Relational Database',
    category: 'Storage',
    Icon: IconDatabase,
  },
  cache: { id: 'cache', label: 'Cache', category: 'Storage', Icon: IconStack },
  cdn: { id: 'cdn', label: 'CDN', category: 'Network', Icon: IconCloudNetwork },
  dns: { id: 'dns', label: 'DNS', category: 'Network', Icon: IconLicense },
  load_balancer: {
    id: 'load_balancer',
    label: 'Load Balancer',
    category: 'Network',
    Icon: IconScale,
  },
  api_gateway: {
    id: 'api_gateway',
    label: 'API Gateway',
    category: 'Network',
    Icon: IconApi,
  },
  private_network: {
    id: 'private_network',
    label: 'Private Network',
    category: 'Network',
    Icon: IconTopologyFull,
  },
  certificate: {
    id: 'certificate',
    label: 'Certificate',
    category: 'Security',
    Icon: IconCertificate,
    defaultEdgeType: 'applies',
  },
  waf: {
    id: 'waf',
    label: 'WAF',
    category: 'Security',
    Icon: IconShieldCheck,
    defaultEdgeType: 'applies',
  },
  queue: {
    id: 'queue',
    label: 'Queue',
    category: 'Messaging',
    Icon: IconAlignBoxCenterMiddle,
  },
  auth: {
    id: 'auth',
    label: 'Auth Service',
    category: 'Security',
    Icon: IconFingerprint,
    defaultEdgeType: 'applies',
  },
  secrets_manager: {
    id: 'secrets_manager',
    label: 'Secrets Manager',
    category: 'Security',
    Icon: IconKey,
  },
  payment_processor: {
    id: 'payment_processor',
    label: 'Payment Processor',
    category: 'Input',
    Icon: IconCreditCard,
  },
};
