import assert from 'assert';
import {
  renderCanonicalVariables,
  extractTemplateVariables,
  type CanonicalVariableContext
} from './variable-resolver';

export async function runVariableResolverTests() {
  console.log('--- STARTING CANONICAL VARIABLE RESOLVER TESTS ---');

  const ctx: CanonicalVariableContext = {
    contact: {
      firstName: 'Subrota',
      lastName: 'Sarker',
      email: 'subrota@ecoray.com',
      title: 'Head of Engineering'
    },
    company: {
      name: 'Ecoray Group',
      domain: 'ecoray.com',
      industry: 'Solar Energy',
      location: 'Dhaka, Bangladesh'
    },
    workspace: {
      id: 'ws_123',
      name: 'LeadForge Workspace'
    },
    sender: {
      name: 'Alice Johnson',
      email: 'alice@leadforge.io'
    }
  };

  // 1. Test Dotted Namespaced Variables
  const dottedTemplate = 'Hi {{contact.firstName}}, welcome to {{company.name}} in {{company.industry}}!';
  const dottedRendered = renderCanonicalVariables(dottedTemplate, ctx);
  assert.strictEqual(
    dottedRendered,
    'Hi Subrota, welcome to Ecoray Group in Solar Energy!'
  );
  console.log('✅ Canonical dotted namespaced variable rendering verified.');

  // 2. Test Legacy Un-namespaced Alias Variables
  const legacyTemplate = 'Hi {{firstName}} {{lastName}}, I noticed {{company}} at {{website}} ({{senderName}} - {{workspaceName}})';
  const legacyRendered = renderCanonicalVariables(legacyTemplate, ctx);
  assert.strictEqual(
    legacyRendered,
    'Hi Subrota Sarker, I noticed Ecoray Group at ecoray.com (Alice Johnson - LeadForge Workspace)'
  );
  console.log('✅ Legacy un-namespaced alias fallback rendering verified.');

  // 3. Test Missing & Unknown Variables (should resolve to empty string)
  const unknownTemplate = 'Hello {{contact.nonExistentField}}, your score is {{variables.unknownScore}}!';
  const unknownRendered = renderCanonicalVariables(unknownTemplate, ctx);
  assert.strictEqual(unknownRendered, 'Hello , your score is !');
  console.log('✅ Missing / unknown variable empty string rendering verified.');

  // 4. Test Variable Extraction
  const tokens = extractTemplateVariables('Subject for {{contact.firstName}} at {{company.name}}');
  assert.deepStrictEqual(tokens, ['contact.firstName', 'company.name']);
  console.log('✅ Template variable token extraction verified.');

  console.log('--- ALL CANONICAL VARIABLE RESOLVER TESTS PASSED ---');
}

if (require.main === module) {
  runVariableResolverTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}
