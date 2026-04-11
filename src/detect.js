/**
 * GPU detection - tries to identify the local GPU model.
 */

const { execSync } = require('child_process');

async function detectGpu() {
  try {
    // Try nvidia-smi first
    const output = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    if (output) return output.split('\n')[0].trim();
  } catch {}

  try {
    // macOS: system_profiler
    const output = execSync('system_profiler SPDisplaysDataType 2>/dev/null | grep "Chip\\|Chipset"', {
      timeout: 5000,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    const match = output.match(/Apple (M\d[\w\s]*)/i);
    if (match) return match[1].trim();
  } catch {}

  try {
    // Linux: lspci
    const output = execSync("lspci | grep -i 'vga\\|3d\\|display' | head -1", {
      timeout: 5000,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    const match = output.match(/NVIDIA.*\[(.*?)\]/i) || output.match(/AMD.*\[(.*?)\]/i);
    if (match) return match[1].trim();
  } catch {}

  return null;
}

module.exports = { detectGpu };
