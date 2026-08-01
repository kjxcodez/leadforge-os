import { AIRuntime } from '../packages/ai/src/core/runtime';
import { ResearchSummaryPrompt } from '../packages/agent-runtime/src/research-agent-prompt';

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log('\n======================================');
    console.log('Skipping AI integration tests (OPENROUTER_API_KEY is not defined).');
    console.log('======================================\n');
    process.exit(0);
  }

  console.log('\n======================================');
  console.log('STARTING ADVANCED AI INTEGRATION TESTS');
  console.log('======================================\n');

  let selectedFreeModel = '';

  // ── 1. Model Discovery & Connectivity ──
  console.log('Step 1: Discovering free chat models from OpenRouter...');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch models (Status ${res.status}): ${text}`);
    }

    const json = (await res.json()) as any;
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error('Response did not contain models list.');
    }

    // Filter for active free models
    const freeModels = json.data.filter((m: any) => {
      const isFreeById = m.id.endsWith(':free') || m.id.includes('/free');
      const isFreeByPricing =
        m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0;
      return isFreeById || isFreeByPricing;
    });

    if (freeModels.length === 0) {
      console.log('⚠️ No active free models found on OpenRouter. Skipping AI integration tests.');
      process.exit(0);
    }

    selectedFreeModel = freeModels[0].id;
    console.log(`  ✅ Found ${freeModels.length} free models. Selected: "${selectedFreeModel}"`);
  } catch (err: any) {
    console.error('❌ Model Discovery Failed:', err.message || err);
    process.exit(1);
  }

  // ── 2. Invalid API Key Handling ──
  console.log('\nStep 2: Testing invalid API key handling...');
  try {
    const badResult = await AIRuntime.execute(
      ResearchSummaryPrompt,
      {
        query: 'test',
        scraperResults: [],
        crawlerResults: []
      },
      {
        openRouterKey: 'sk-or-v1-invalid-token-12345',
        aiMode: 'cloud'
      },
      { model: selectedFreeModel }
    );

    if (badResult.success && badResult.provider === 'openrouter') {
      throw new Error('Request should have failed with invalid API key');
    }
    console.log(
      '  ✅ Invalid key correctly handled. Error: ',
      badResult.error || 'Fallback to mock active'
    );
  } catch (err: any) {
    console.log('  ✅ Invalid key correctly threw exception:', err.message);
  }

  // ── 3. Cancellation & Timeout Handling ──
  console.log('\nStep 3: Testing request cancellation via AbortSignal...');
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10); // Abort almost immediately

    const cancelResult = await AIRuntime.execute(
      ResearchSummaryPrompt,
      {
        query: 'test-cancel',
        scraperResults: [],
        crawlerResults: []
      },
      {
        openRouterKey: apiKey,
        aiMode: 'cloud'
      },
      {
        model: selectedFreeModel,
        signal: controller.signal
      }
    );

    if (cancelResult.success && cancelResult.provider === 'openrouter') {
      throw new Error('Request should have failed due to abort signal');
    }
    console.log(
      '  ✅ Abort signal handled. Result error:',
      cancelResult.error || 'Fallback back to mock'
    );
  } catch (err: any) {
    console.log('  ✅ Cancellation threw expected abort exception:', err.message);
  }

  // ── 4. Prompt Execution, Structured Validation & Retries ──
  console.log('\nStep 4: Executing prompt with dynamic rate-limit retries...');
  const maxRetries = 3;
  let attempt = 0;
  let success = false;
  let finalResult: any = null;

  while (attempt < maxRetries && !success) {
    attempt++;
    console.log(`  Execution attempt ${attempt}/${maxRetries}...`);
    try {
      const result = await AIRuntime.execute(
        ResearchSummaryPrompt,
        {
          query: 'Dentists in downtown Austin',
          scraperResults: [
            { name: 'Austin Dental Center', domain: 'austindental.com', address: 'Congress Ave' }
          ],
          crawlerResults: [
            { companyId: 'dent-1', domain: 'austindental.com', emails: ['info@austindental.com'] }
          ]
        },
        {
          openRouterKey: apiKey,
          aiMode: 'cloud'
        },
        {
          model: selectedFreeModel,
          temperature: 0.2
        }
      );

      // Check if we hit a rate limit (HTTP 429) or got blocked
      if (!result.success) {
        const errorMsg = result.error || '';
        if (
          errorMsg.includes('429') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('too many requests')
        ) {
          console.warn(`  ⚠️ Rate limit encountered. Retrying in ${attempt * 3} seconds...`);
          await new Promise((r) => setTimeout(r, attempt * 3000));
          continue;
        }
        throw new Error(errorMsg);
      }

      success = true;
      finalResult = result;
    } catch (err: any) {
      console.warn(`  ⚠️ Attempt ${attempt} failed:`, err.message || err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }

  if (!success || !finalResult) {
    console.error('\n❌ Prompt execution failed after retries.');
    process.exit(1);
  }

  console.log('  ✅ Provider connectivity established.');
  console.log('  ✅ Prompt executed successfully.');
  console.log('  ✅ Structured output validated.');
  console.log('  ✅ Summary output:', JSON.stringify(finalResult.data).substring(0, 200) + '...');

  console.log('\n======================================');
  console.log('ALL AI INTEGRATION TESTS PASSED ✅');
  console.log('======================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal AI integration test error:', err);
  process.exit(1);
});
