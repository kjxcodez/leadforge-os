/**
 * Master test runner for agent-core unit tests.
 */
async function runAllTests() {
  console.log('\n======================================');
  console.log('STARTING AGENT CORE UNIT TESTS');
  console.log('======================================');

  try {
    await import('./registry.test');
    console.log('\n======================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (EXIT 0)');
    console.log('======================================\n');
  } catch (error) {
    console.error('\n❌ TEST SUITE RUN ENCOUNTERED ERRORS:', error);
    process.exit(1);
  }
}

runAllTests();
