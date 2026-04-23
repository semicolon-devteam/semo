export { buildApp, type AppDeps } from './app.js';
export { PgKbService, type KbService } from './lib/kb-service.js';
export { verifySignature, signPayload, type AuthResult } from './lib/auth.js';
export type {
  KBItem,
  KbGetRequest,
  KbSearchRequest,
  KbUpsertRequest,
  KbEmbedRequest,
  KbEmbedResponse,
  ErrorResponse,
} from './types.js';
