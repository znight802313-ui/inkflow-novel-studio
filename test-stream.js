async function testStreamAPI() {
  console.log('Testing streaming API for claude-sonnet-4-5-20250929...');

  const response = await fetch('https://mixai.cc/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-a7YqF4A9MnkAWjxq'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      messages: [
        { role: 'user', content: '请写一段50字的小说开头' }
      ],
      temperature: 0.7,
      max_tokens: 200,
      stream: true
    })
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.log('Error:', error);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            process.stdout.write(content);
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }
    }
  }

  console.log('\n\nTotal text length:', fullText.length);
  console.log('Stream test completed successfully!');
}

testStreamAPI().catch(console.error);
