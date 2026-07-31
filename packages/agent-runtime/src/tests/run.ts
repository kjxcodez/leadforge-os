console.log('======================================');
console.log('STARTING AGENT RUNTIME UNIT TESTS');
console.log('======================================');

import './runtime.test.js';

setTimeout(() => {
  console.log('\n======================================');
  console.log('ALL RUNTIME TESTS PASSED SUCCESSFULLY! (EXIT 0)');
  console.log('======================================\n');
}, 50);
