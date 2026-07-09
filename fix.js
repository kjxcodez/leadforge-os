const fs = require('fs');
const path = require('path');

function fix(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      fix(p);
    } else if (p.endsWith('.ts')) {
      let content = fs.readFileSync(p, 'utf8');
      if (content.endsWith('\\n')) {
        content = content.slice(0, -2) + '\n';
        fs.writeFileSync(p, content);
      } else if (content.endsWith('\\n\n')) {
        content = content.slice(0, -3) + '\n';
        fs.writeFileSync(p, content);
      } else if (content.endsWith('\\n\r\n')) {
        content = content.slice(0, -4) + '\n';
        fs.writeFileSync(p, content);
      }
    }
  }
}

fix(process.argv[2]);
console.log('Fixed:', process.argv[2]);
