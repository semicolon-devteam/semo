#!/usr/bin/env node
/**
 * SEMO Token Generator
 *
 * CI/CD에서 실행되어 암호화된 토큰을 생성합니다.
 *
 * 사용법:
 *   SEMO_SLACK_BOT_TOKEN=xoxb-xxx SEMO_DB_PASSWORD=xxx node scripts/generate-tokens.js
 *
 * 출력:
 *   src/tokens.generated.ts 파일 생성
 *
 * 주의: 암호화 키는 crypto.ts의 TEAM_TOKEN_KEY와 동일해야 함
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

// crypto.ts와 동일한 고정 키 사용 (난독화 목적)
const TEAM_TOKEN_KEY = "semo-team-token-key-2024-secure";

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(TEAM_TOKEN_KEY.padEnd(32, "0").slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

function main() {
  const slackToken = process.env.SEMO_SLACK_BOT_TOKEN;
  const githubToken = process.env.SEMO_GITHUB_APP_TOKEN || "";
  const dbPassword = process.env.SEMO_DB_PASSWORD || "";

  if (!slackToken) {
    console.error("Error: SEMO_SLACK_BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  const encryptedSlack = encrypt(slackToken);
  const encryptedGithub = githubToken ? encrypt(githubToken) : "";
  const encryptedDbPassword = dbPassword ? encrypt(dbPassword) : "";

  const content = `/**
 * SEMO Encrypted Team Tokens
 *
 * 이 파일은 CI/CD에서 자동 생성되었습니다.
 * 직접 수정하지 마세요.
 *
 * Generated: ${new Date().toISOString()}
 */

// 암호화된 팀 공용 토큰
export const ENCRYPTED_TOKENS = {
  // Slack Bot Token (Semicolon Notifier)
  SLACK_BOT_TOKEN: "${encryptedSlack}",

  // GitHub App Token (Team Bot)
  GITHUB_APP_TOKEN: "${encryptedGithub}",

  // SEMO DB Password (Long-term Memory)
  DB_PASSWORD: "${encryptedDbPassword}",
};

// 토큰 존재 여부 확인
export function hasEncryptedToken(name: keyof typeof ENCRYPTED_TOKENS): boolean {
  return !!ENCRYPTED_TOKENS[name];
}
`;

  const outputPath = path.join(__dirname, "..", "src", "tokens.generated.ts");
  fs.writeFileSync(outputPath, content);

  console.log(`[SEMO] Encrypted tokens generated: ${outputPath}`);
  console.log(`[SEMO] Slack token: ${encryptedSlack.slice(0, 20)}...`);
  if (encryptedGithub) {
    console.log(`[SEMO] GitHub token: ${encryptedGithub.slice(0, 20)}...`);
  }
  if (encryptedDbPassword) {
    console.log(`[SEMO] DB password: ${encryptedDbPassword.slice(0, 20)}...`);
  }
}

main();
