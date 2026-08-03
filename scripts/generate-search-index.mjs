import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const outputDir = path.join(rootDir, 'apps/marketing/public');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function parseFrontmatter(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return { frontmatter: {}, content: rawContent };

  const fmText = match[1];
  const content = rawContent.substring(match[0].length).trim();
  
  const frontmatter = {};
  fmText.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = val;
    }
  });

  return { frontmatter, content };
}

function extractHeadings(content) {
  const headings = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    if (line.startsWith('#')) {
      const match = line.match(/^(#{2,3})\s+(.*)$/);
      if (match) {
        const text = match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
        headings.push(text);
      }
    }
  }
  return headings;
}

function getMdxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getMdxFiles(filePath));
    } else if (file.endsWith('.mdx')) {
      results.push(filePath);
    }
  });
  return results;
}

const mdxFiles = getMdxFiles(docsDir);
const index = [];

mdxFiles.forEach(filePath => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, content } = parseFrontmatter(raw);
  
  if (!frontmatter.title) return;

  const relativePath = path.relative(docsDir, filePath).replace(/\\/g, '/');
  const cleanSlug = relativePath.replace(/\.mdx$/, '');
  const urlPath = `/docs/${cleanSlug}`;

  const headings = extractHeadings(content);
  
  const textKeywords = content
    .split('\n')
    .filter(line => !line.startsWith('```') && !line.trim().startsWith('|') && !line.trim().startsWith('>'))
    .join(' ')
    .replace(/[^\w\s-]/g, ' ')
    .substring(0, 1500)
    .replace(/\s+/g, ' ')
    .trim();

  index.push({
    title: frontmatter.title,
    description: frontmatter.description || '',
    category: frontmatter.category || '',
    slug: cleanSlug,
    url: urlPath,
    headings,
    text: textKeywords
  });
});

fs.writeFileSync(
  path.join(outputDir, 'search-index.json'),
  JSON.stringify(index, null, 2),
  'utf8'
);
console.log(`Search index successfully compiled with ${index.length} entries! 🔍`);
