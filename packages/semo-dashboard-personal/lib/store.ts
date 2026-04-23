import 'server-only';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function semoHome(): string {
  return process.env.SEMO_HOME || path.join(os.homedir(), '.semo');
}

export interface PersonalStoreStatus {
  semoHome: string;
  kbPath: string;
  opsPath: string;
  kbExists: boolean;
  opsExists: boolean;
}

export function getStatus(): PersonalStoreStatus {
  const root = semoHome();
  const kbPath = path.join(root, 'kb.db');
  const opsPath = path.join(root, 'ops.db');
  return {
    semoHome: root,
    kbPath,
    opsPath,
    kbExists: fs.existsSync(kbPath),
    opsExists: fs.existsSync(opsPath),
  };
}
