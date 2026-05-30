/**
 * AES-256-GCM 채널 크리덴셜 암호화 헬퍼.
 *
 * tenant_channels.credentials_encrypted JSONB 에 저장될 페이로드를 만든다.
 * 키는 `SEMO_CHANNEL_ENC_KEY` (32-byte base64) 환경변수에서 읽고,
 * **fail-closed**: 키가 없으면 즉시 throw (prod/dev/test 모두). 평문으로 저장하지 않는다.
 *
 * IV 는 매 암호화마다 12-byte random. tag 는 GCM auth tag 16 bytes.
 * iv/tag/ciphertext 모두 base64 로 직렬화해 JSONB 친화적으로 저장.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto';

/** 직렬화된 암호문. JSONB 컬럼에 그대로 저장. */
export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

const KEY_ENV = 'SEMO_CHANNEL_ENC_KEY';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

/**
 * 환경변수에서 32-byte 키를 base64 로 디코딩해 가져온다.
 * 키가 없거나 길이가 틀리면 즉시 throw (fail-closed).
 *
 * Codex CRITICAL: 키가 없어도 dev/test 에서 silently plaintext 로 저장하면
 * 마이그레이션·로컬 dump 경유로 토큰 유출 위험. 어떤 환경이든 키 없으면 거부.
 */
function getKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`${KEY_ENV} not configured`);
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${KEY_ENV} is not valid base64`);
  }
  if (key.length !== KEY_LEN) {
    throw new Error(`${KEY_ENV} must decode to ${KEY_LEN} bytes (got ${key.length})`);
  }
  return key;
}

/**
 * 객체(JSON 직렬화 가능)를 AES-256-GCM 으로 암호화한다.
 * 결과 페이로드를 그대로 DB JSONB 컬럼에 INSERT 하면 된다.
 */
export function encryptCredentials(obj: object): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
  };
}

/**
 * 암호문 페이로드를 복호화해 원본 객체로 돌려준다.
 * tag 가 안 맞으면 createDecipheriv.final() 단계에서 throw.
 */
export function decryptCredentials(payload: EncryptedPayload): object {
  const key = getKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  if (iv.length !== IV_LEN) {
    throw new Error(`invalid iv length: ${iv.length}`);
  }
  const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as object;
}
