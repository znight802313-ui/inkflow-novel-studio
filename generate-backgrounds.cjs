const fs = require('fs');
const https = require('https');

const API_CONFIG = {
  baseUrl: 'https://api.newcoin.tech',
  apiKey: 'sk-3r6UM9oKHp1GJcuFNpcfXRedeD3AS74gS3r0IapOgpmDsGOd',
  model: 'jimeng-4.5'
};

const backgrounds = [
  {
    name: 'bg-hero.png',
    prompt: '高级感网页背景设计，深色调奢华质感。深邃的星空渐变（深蓝→深紫→黑色），金色粒子光点，柔和的光晕效果，抽象的流体形状，毛玻璃质感。现代简约高端科技感。16:9横版构图，超高清8K质量'
  },
  {
    name: 'bg-features.png',
    prompt: '高级感网页背景，浅色调优雅质感。柔和的渐变（浅灰→白色→淡蓝），抽象几何图形，光影层次，毛玻璃效果。简约现代高端。16:9横版构图，超高清8K质量'
  },
  {
    name: 'bg-cta.png',
    prompt: '高级感网页背景，深色渐变（深紫→深蓝→黑色），流动的光线轨迹，金色光点，科技感网格，毛玻璃质感。现代奢华高端。16:9横版构图，超高清8K质量'
  }
];

async function generateImage(prompt, filename) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: API_CONFIG.model,
      prompt: prompt,
      size: '1792x1024',
      n: 1,
      response_format: 'b64_json'
    });

    const options = {
      hostname: 'api.newcoin.tech',
      port: 443,
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`🎨 Generating ${filename}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.data && response.data[0] && response.data[0].b64_json) {
            const buffer = Buffer.from(response.data[0].b64_json, 'base64');
            fs.writeFileSync(`public/${filename}`, buffer);
            console.log(`✅ ${filename} saved (${buffer.length} bytes)`);
            resolve();
          } else {
            reject(new Error(`Invalid response for ${filename}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Starting background generation...\n');

  for (const bg of backgrounds) {
    try {
      await generateImage(bg.prompt, bg.name);
      // Wait 2 seconds between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error generating ${bg.name}:`, error.message);
    }
  }

  console.log('\n✨ All backgrounds generated!');
}

main();
