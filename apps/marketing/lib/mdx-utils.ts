import fs from 'fs';
import path from 'path';

const docsDir = path.join(process.cwd(), '../../docs');

export interface NavItem {
  id: string;
  title: string;
  category: string;
  order: number;
  slug: string[];
  url: string;
}

export interface NavGroup {
  category: string;
  items: NavItem[];
}

function parseFrontmatter(rawContent: string) {
  const match = rawContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return { frontmatter: {} as any, content: rawContent };

  const fmText = match[1];
  const content = rawContent.substring(match[0].length).trim();
  
  const frontmatter: Record<string, string> = {};
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

function getMdxFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // Explicitly skip the archive directory to keep it hidden from live docs
      if (file === 'archive') return;
      results = results.concat(getMdxFiles(filePath));
    } else if (file.endsWith('.mdx') || file.endsWith('.md')) {
      results.push(filePath);
    }
  });
  return results;
}

export function getDocsNavigation(): NavGroup[] {
  const files = getMdxFiles(docsDir);
  const items: NavItem[] = [];

  files.forEach(filePath => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { frontmatter } = parseFrontmatter(raw);
    
    if (!frontmatter.title) return;

    const relativePath = path.relative(docsDir, filePath).replace(/\\/g, '/');
    const cleanSlug = relativePath.replace(/\.(mdx|md)$/, '');
    const slugParts = cleanSlug.split('/');
    const urlPath = `/docs/${cleanSlug}`;

    items.push({
      id: cleanSlug,
      title: frontmatter.title,
      category: frontmatter.category || 'General',
      order: parseInt(frontmatter.order || '999') || 999,
      slug: slugParts,
      url: urlPath
    });
  });

  const groupsRecord: Record<string, NavItem[]> = {
    "Getting Started": [],
    "Architecture": [],
    "API": [],
    "Security": [],
    "Development": [],
    "Diagnostics": [],
    "ADRs": []
  };

  items.forEach(item => {
    const cat = item.category;
    if (!groupsRecord[cat]) {
      groupsRecord[cat] = [];
    }
    groupsRecord[cat].push(item);
  });

  return Object.entries(groupsRecord)
    .filter(([_, list]) => list.length > 0)
    .map(([category, list]) => {
      const sortedList = [...list].sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (category === "ADRs") {
          const numA = parseInt(a.id.replace("adr/ADR-", "")) || 0;
          const numB = parseInt(b.id.replace("adr/ADR-", "")) || 0;
          return numA - numB;
        }
        return a.title.localeCompare(b.title);
      });
      return { category, items: sortedList };
    });
}

export function getDocBySlug(slug: string[]): {
  content: string;
  frontmatter: {
    title: string;
    description?: string;
    category?: string;
    order?: number;
  };
} | null {
  const slugPath = slug.join('/');
  
  const possiblePaths = [
    slug.length === 0 ? 'getting-started/installation.mdx' : `${slugPath}.mdx`,
    slug.length === 0 ? 'getting-started/installation.md' : `${slugPath}.md`,
    slug.length === 0 ? 'getting-started/installation.mdx' : `${slugPath}/index.mdx`,
    slug.length === 0 ? 'getting-started/installation.mdx' : `${slugPath}/index.md`,
    slug.length === 0 ? 'getting-started/installation.mdx' : `${slugPath}/README.mdx`,
    slug.length === 0 ? 'getting-started/installation.mdx' : `${slugPath}/README.md`,
    slugPath
  ];

  let filePath = '';
  for (const p of possiblePaths) {
    const fullPath = path.join(docsDir, p);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      filePath = fullPath;
      break;
    }
  }

  if (!filePath) return null;


  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, content } = parseFrontmatter(raw);

  return {
    content,
    frontmatter: {
      title: frontmatter.title || 'Untitled',
      description: frontmatter.description,
      category: frontmatter.category,
      order: parseInt(frontmatter.order || '999') || 999
    }
  };
}
