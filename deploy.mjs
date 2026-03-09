import { readFileSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';

// Read vault path from deploy.config.json
let config;
try {
    config = JSON.parse(readFileSync('deploy.config.json', 'utf8'));
} catch (e) {
    console.error('Error: deploy.config.json not found or invalid.');
    console.error('Create deploy.config.json with: { "vaultPath": "/path/to/your/vault" }');
    process.exit(1);
}

const { vaultPath } = config;
if (!vaultPath) {
    console.error('Error: "vaultPath" not set in deploy.config.json');
    process.exit(1);
}

// Read plugin ID from manifest
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pluginDir = join(vaultPath, '.obsidian', 'plugins', manifest.id);

// Ensure plugin directory exists
mkdirSync(pluginDir, { recursive: true });

// Copy built files
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    copyFileSync(file, join(pluginDir, file));
    console.log(`Copied ${file} → ${pluginDir}/`);
}
