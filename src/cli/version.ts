import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageJson {
  version: string;
  name?: string;
}

// Read version from package.json
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;

export const VERSION: string = packageJson.version;
