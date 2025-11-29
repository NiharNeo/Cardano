import fs from 'fs';
import path from 'path';

/**
 * Load Aiken-compiled Plutus script from file
 * @param scriptPath Path to .plutus file
 * @returns Parsed script JSON with cborHex
 */
export const loadScript = (scriptPath: string): { type: string; description: string; cborHex: string } => {
  const fullPath = path.isAbsolute(scriptPath) 
    ? scriptPath 
    : path.join(__dirname, '../..', scriptPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Script not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Aiken outputs JSON format
  if (content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (!parsed.cborHex) {
        throw new Error('Script JSON missing cborHex field');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Invalid script JSON: ${error}`);
    }
  }
  
  // Fallback: assume raw hex
  return {
    type: 'PlutusScriptV2',
    description: 'Aiken-compiled script',
    cborHex: content.trim()
  };
};



