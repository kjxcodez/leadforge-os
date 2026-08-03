const fs = require('fs');
const path = require('path');

const adrDir = path.join(__dirname, '../docs/adr');

if (!fs.existsSync(adrDir)) {
  console.error("ADR directory not found:", adrDir);
  process.exit(1);
}

const files = fs.readdirSync(adrDir).filter(f => f.startsWith('ADR-') && f.endsWith('.mdx'));

files.forEach(file => {
  const filePath = path.join(adrDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Extract title
  const titleMatch = content.match(/^title:\s*"ADR-\d+:\s*([^"]+)"/m);
  if (!titleMatch) {
    console.log("No title found in", file);
    return;
  }
  const chosenName = titleMatch[1].trim();

  // Find Alternatives Considered section
  const sectionSplit = "## Alternatives Considered";
  const index = content.indexOf(sectionSplit);
  if (index === -1) {
    console.log("No Alternatives Considered section found in", file);
    return;
  }

  // Check if a Mermaid diagram is already present
  if (content.includes("```mermaid")) {
    console.log("Mermaid diagram already present in", file);
    return;
  }

  const beforeSection = content.substring(0, index + sectionSplit.length);
  const afterSection = content.substring(index + sectionSplit.length);

  // Extract alternatives
  const altRegex = /^-\s+\*\*([^*]+)\*\*[:\s]/gm;
  let alts = [];
  let match;
  while ((match = altRegex.exec(afterSection)) !== null) {
    alts.push(match[1].trim());
  }

  if (alts.length === 0) {
    console.log("No alternatives parsed in", file);
    return;
  }

  // Generate Mermaid diagram
  let diagram = "\n\n```mermaid\n";
  diagram += "%%{init: {'theme': 'base', 'themeVariables': {\n";
  diagram += "  'primaryColor': '#1a1a1a',\n";
  diagram += "  'primaryTextColor': '#f5f5f5',\n";
  diagram += "  'primaryBorderColor': '#E8622C',\n";
  diagram += "  'lineColor': '#E8622C',\n";
  diagram += "  'background': '#0d0d0d',\n";
  diagram += "  'fontFamily': 'Inter'\n";
  diagram += "}}}%%\n";
  diagram += "flowchart TD\n";
  
  alts.forEach((alt, idx) => {
    diagram += `  Opt${idx}["${alt}"] -->|Rejected| Decision{Decision: ${chosenName}}\n`;
  });
  diagram += `  Chosen["${chosenName}"] -->|Chosen| Decision\n`;
  diagram += "```\n";

  // Reconstruct content
  const newContent = beforeSection + diagram + afterSection;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log("Successfully added diagram to", file);
});
