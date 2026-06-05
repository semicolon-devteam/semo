export { buildApp, type AppDeps } from './app.js';
export { PgKbService, type KbService } from './lib/kb-service.js';
export { verifySignature, signPayload, type AuthResult } from './lib/auth.js';
export {
  TenantKbService,
  tenantDomain,
  type TenantSearchOpts,
  type TenantUpsertInput,
} from './lib/tenant-kb.js';
export { PersonaService, type ResolvedPersona } from './lib/persona-service.js';
export {
  TenantCredentialResolver,
  generateTenantToken,
  hashToken,
  parseBearer,
  isTenantToken,
  TENANT_TOKEN_PREFIX,
  type GeneratedToken,
  type ResolverOptions,
} from './lib/tenant-credentials.js';
export type {
  KBItem,
  KbGetRequest,
  KbSearchRequest,
  KbUpsertRequest,
  KbEmbedRequest,
  KbEmbedResponse,
  ErrorResponse,
  GatewayScope,
  TenantContext,
  PersonaResolveRequest,
  PersonaResolveResponse,
} from './types.js';
