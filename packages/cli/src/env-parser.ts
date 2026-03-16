/**
 * 공용 KEY=VALUE 파서
 * ~/.semo.env 파일과 GitHub Gist 콘텐츠 모두 이 함수로 파싱한다.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const raw of content.split("\n")) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    if (key) result[key] = val;
  }
  return result;
}
