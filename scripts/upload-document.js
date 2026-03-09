#!/usr/bin/env node

// Upload a document to the Brainstorm app's documents table.
// Usage: node scripts/upload-document.js <file-path> <slug> <title> <keywords-comma-separated>
// Example: node scripts/upload-document.js ~/path/to/roth-ebook.md roth-ebook "Top 5 Roth IRA Conversion Mistakes" "roth,ebook,book,conversion,ira,401k,rmd,tax-free"

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE || 'https://bmad-voice.vercel.app';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.log('Usage: node scripts/upload-document.js <file-path> <slug> <title> <keywords-comma-separated>');
    console.log('');
    console.log('Environment variables:');
    console.log('  SESSION_SECRET  - Required. The app admin secret.');
    console.log('  API_BASE        - Optional. Defaults to https://bmad-voice.vercel.app');
    process.exit(1);
  }

  const [filePath, slug, title, keywordsStr] = args;
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    console.error('Error: SESSION_SECRET environment variable is required.');
    console.error('Set it with: export SESSION_SECRET=your_secret_here');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);

  console.log(`Uploading document...`);
  console.log(`  Slug: ${slug}`);
  console.log(`  Title: ${title}`);
  console.log(`  Keywords: ${keywords.join(', ')}`);
  console.log(`  Content length: ${content.length} chars`);
  console.log(`  API: ${API_BASE}/api/documents`);

  const response = await fetch(`${API_BASE}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, title, keywords, content, secret }),
  });

  const result = await response.json();

  if (response.ok) {
    console.log('Upload successful:', result);
  } else {
    console.error('Upload failed:', response.status, result);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
