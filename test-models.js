// Test script for all configured models
const models = [
  'claude-sonnet-4-5-thinking',
  'gemini-3-pro-preview-thinking',
  'gemini-3-flash-preview',
  'gpt-5.2',
  'claude-sonnet-4-5-20250929'
];

const configs = {
  'claude-sonnet-4-5-thinking': {
    baseUrl: 'https://once.novai.su/v1',
    apiKey: 'sk-KW7XVLjLAHeiMGPhQAPypobB99AjT96FftTLCgujCwT0UYuA'
  },
  'gemini-3-pro-preview-thinking': {
    baseUrl: 'https://once.novai.su/v1',
    apiKey: 'sk-KW7XVLjLAHeiMGPhQAPypobB99AjT96FftTLCgujCwT0UYuA'
  },
  'gemini-3-flash-preview': {
    baseUrl: 'https://once.novai.su/v1',
    apiKey: 'sk-KW7XVLjLAHeiMGPhQAPypobB99AjT96FftTLCgujCwT0UYuA'
  },
  'gpt-5.2': {
    baseUrl: 'https://once.novai.su/v1',
    apiKey: 'sk-KW7XVLjLAHeiMGPhQAPypobB99AjT96FftTLCgujCwT0UYuA'
  },
  'claude-sonnet-4-5-20250929': {
    baseUrl: 'https://mixai.cc/v1',
    apiKey: 'sk-a7YqF4A9MnkAWjxq'
  }
};

async function testModel(modelName) {
  const config = configs[modelName];
  console.log(`\n🧪 Testing: ${modelName}`);
  console.log(`   Base URL: ${config.baseUrl}`);
  console.log(`   API Key: ${config.apiKey.substring(0, 10)}...`);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'user', content: '请用一句话介绍你自己' }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ Failed: ${response.status} - ${errorText.substring(0, 200)}`);
      return false;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`   ✅ Success: ${content.substring(0, 100)}...`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 Starting Model API Tests');
  console.log('='.repeat(60));

  const results = {};

  for (const model of models) {
    results[model] = await testModel(model);
    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  let successCount = 0;
  for (const [model, success] of Object.entries(results)) {
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${model}`);
    if (success) successCount++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${successCount}/${models.length} models working`);
  console.log('='.repeat(60));
}

runTests().catch(console.error);
