import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: 'AWS Secret Key', regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, contextual: true },
  { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g },
  { name: 'GitHub Fine-Grained Token', regex: /github_pat_[A-Za-z0-9_]{82}/g },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Razorpay Live Key', regex: /rzp_live_[0-9a-zA-Z]{14,24}/g },
  { name: 'Razorpay Test Key', regex: /rzp_test_[0-9a-zA-Z]{14,24}/g },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Postgres Connection String with Password', regex: /postgres(?:ql)?:\/\/[^:]+:([^@]+)@[^/]+\/[^\s"']+/g },
  { name: 'Redis Connection String with Password', regex: /redis:\/\/[^:]*:([^@]+)@[^\s"']+/g },
  { name: 'Telegram Bot Token', regex: /(?:^|[^0-9])([0-9]{9,10}:[a-zA-Z0-9_-]{35})(?:[^a-zA-Z0-9_-]|$)/g },
  { name: 'Hardcoded Default Passcode (fixia2026)', regex: /fixia2026/gi },
  { name: 'JWT Secret Hardcoded Assignment', regex: /(?:JWT_SECRET|jwt_secret)\s*[:=]\s*['"][^'"]{8,}['"]/g },
];

function redact(str) {
  if (str.length <= 8) return '***';
  return str.slice(0, 4) + '...' + str.slice(-4);
}

function isFalsePositive(matchedStr, content, matchIndex, rule) {
  if (
    matchedStr.includes('mock_') ||
    matchedStr.includes('example') ||
    matchedStr.includes('replace_in_prod') ||
    matchedStr.includes('localman_secure_dev_password_2026') ||
    matchedStr.includes('localman_ci_password_2026') ||
    matchedStr.includes('test_')
  ) {
    return true;
  }

  // Pure 40-character hex string is a Git commit hash or Flutter revision hash
  if (rule.name === 'AWS Secret Key') {
    if (/^[0-9a-f]{40}$/i.test(matchedStr)) {
      return true;
    }
    // URL or file paths containing slashes
    if (matchedStr.includes('/') || matchedStr.includes('\\')) {
      return true;
    }
    // For contextual rules, check if surrounding window contains secret key context
    if (rule.contextual && content) {
      const start = Math.max(0, matchIndex - 80);
      const end = Math.min(content.length, matchIndex + matchedStr.length + 80);
      const snippet = content.slice(start, end).toLowerCase();
      if (
        !snippet.includes('aws') &&
        !snippet.includes('secret') &&
        !snippet.includes('access_key') &&
        !snippet.includes('credentials')
      ) {
        return true;
      }
    }
  }

  return false;
}

export function scanWorkingTree(dir, options = {}) {
  const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.dart_tool', 'ios', 'android', 'scratch', '.system_generated', ...(options.extraIgnore || [])]);
  const findings = [];

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const filePath = path.join(currentDir, entry.name);
        const relPath = path.relative(dir, filePath);
        const normalized = relPath.replace(/\\/g, '/');

        // Ignore the scanner itself and documentation / binary files
        if (normalized === 'scripts/audit-secrets.js') {
          continue;
        }

        // Skip binary and lockfiles
        if (
          normalized.endsWith('.png') ||
          normalized.endsWith('.jpg') ||
          normalized.endsWith('.jpeg') ||
          normalized.endsWith('.svg') ||
          normalized.endsWith('.ico') ||
          normalized.endsWith('.pdf') ||
          normalized.endsWith('.mp4') ||
          normalized.endsWith('package-lock.json')
        ) {
          continue;
        }

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          for (const rule of SECRET_PATTERNS) {
            rule.regex.lastIndex = 0;
            let match;
            while ((match = rule.regex.exec(content)) !== null) {
              const matchedStr = match[0];
              if (isFalsePositive(matchedStr, content, match.index, rule)) {
                continue;
              }
              findings.push({
                file: relPath,
                rule: rule.name,
                matchRedacted: redact(matchedStr),
              });
            }
          }
        } catch {
          // ignore read error
        }
      }
    }
  }

  walk(dir);
  return findings;
}

export function scanGitHistory(repoDir) {
  const findings = [];
  try {
    const logOutput = execSync('git log --all -p --reverse', { cwd: repoDir, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
    const commits = logOutput.split(/^commit ([a-f0-9]{40})/gm);

    for (let i = 1; i < commits.length; i += 2) {
      const commitHash = commits[i];
      const commitBody = commits[i + 1] || '';

      for (const rule of SECRET_PATTERNS) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(commitBody)) !== null) {
          const matchedStr = match[0];
          if (isFalsePositive(matchedStr, commitBody, match.index, rule)) {
            continue;
          }
          findings.push({
            commit: commitHash.slice(0, 10),
            rule: rule.name,
            matchRedacted: redact(matchedStr),
          });
        }
      }
    }
  } catch (err) {
    findings.push({ error: err.message });
  }
  return findings;
}

const targetDir = process.argv[2] || process.cwd();
console.log(`Scanning directory: ${targetDir}`);
const treeFindings = scanWorkingTree(targetDir);
console.log('--- Working Tree Findings ---');
console.log(JSON.stringify(treeFindings, null, 2));

console.log('--- Git History Findings ---');
const historyFindings = scanGitHistory(targetDir);
console.log(JSON.stringify(historyFindings, null, 2));
