
/**
 * Multi-Agent CLI for Nurse Scheduler Project
 * Supports: AI Agent, Gemma 3, Qwen 3
 * Standard: OpenAI-compatible API
 */

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
ðŸš€ AI Agent CLI - Nurse Scheduler

Usage:
  node --env-file=.env.local scripts/ai-agent.mjs [options] "Your message"

Options:
  --unified (default)  Use Unified AI Agent (https://pnt.badt.vn/ai_agent/v1)
  --gemma              Use Gemma 3 (https://pnt.badt.vn/gemma4/v1)
  --qwen               Use Qwen 3 Claude Distill (https://pnt.badt.vn/qwen3/v1)
  --system "..."       Set system prompt
  --stream             Enable streaming response
  --help, -h           Show this help

Example:
  node --env-file=.env.local scripts/ai-agent.mjs --qwen "Tá»‘i Æ°u hÃ m tÃ­nh lÆ°Æ¡ng nhÃ¢n viÃªn" --stream
  `);
  process.exit(0);
}

// Configuration
const API_TOKEN = process.env.AI_API_TOKEN;
if (!API_TOKEN) {
  console.error("âŒ Error: AI_API_TOKEN not found in environment. Please check .env.local");
  process.exit(1);
}

// Parse arguments
let mode = 'unified';
let systemPrompt = "Báº¡n lÃ  trá»£ lÃ½ AI y táº¿ thÃ´ng minh, há»— trá»£ dá»± Ã¡n NurseFlow.";
let isStream = false;
let userPrompt = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gemma') mode = 'gemma';
  else if (args[i] === '--qwen') mode = 'qwen';
  else if (args[i] === '--unified') mode = 'unified';
  else if (args[i] === '--stream') isStream = true;
  else if (args[i] === '--system' && args[i+1]) {
    systemPrompt = args[i+1];
    i++;
  } else if (!args[i].startsWith('--')) {
    userPrompt = args[i];
  }
}

if (!userPrompt) {
  console.error("âŒ Error: Missing user message.");
  process.exit(1);
}

// Map settings
const CONFIGS = {
  unified: {
    baseUrl: "https://pnt.badt.vn/ai_agent/v1",
    model: "ai-agent"
  },
  gemma: {
    baseUrl: "https://pnt.badt.vn/gemma4/v1",
    model: "gemma-3-4b-it"
  },
  qwen: {
    baseUrl: "https://pnt.badt.vn/qwen3/v1",
    model: "qwen3-claude-distill"
  }
};

const currentConfig = CONFIGS[mode];

async function processStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  process.stdout.write("\nâœ… Response (Streaming): ");
  
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    
    for (const line of lines) {
      handleStreamLine(line);
    }
  }
  console.log("\n");
}

async function processStreamFromText(text) {
  process.stdout.write("\nâœ… Response (Auto-detected Stream): ");
  const lines = text.split('\n');
  for (const line of lines) {
    handleStreamLine(line);
  }
  console.log("\n");
}

function handleStreamLine(line) {
  const trimmedLine = line.trim();
  if (trimmedLine === '' || trimmedLine === 'data: [DONE]') return;
  if (trimmedLine.startsWith('data: ')) {
    const jsonStr = trimmedLine.substring(6);
    try {
      const json = JSON.parse(jsonStr);
      const content = json.choices[0]?.delta?.content || json.choices[0]?.message?.content || "";
      process.stdout.write(content);
    } catch {}
  }
}

async function runWithRetry(maxRetries = 3) {
  console.log(`\x1b[36mðŸ¤– Calling ${mode.toUpperCase()} Agent (Base: ${currentConfig.baseUrl})...\x1b[0m`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${currentConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: currentConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          stream: isStream,
          max_tokens: 2048,
          temperature: 0.7
        })
      });

      // Handle Rate Limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 5;
        console.warn(`\x1b[33mâš ï¸ Rate limited. Waiting ${retryAfter}s before retry ${attempt}/${maxRetries}...\x1b[0m`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`API Error ${response.status}: ${errData}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      
      if (isStream || contentType.includes('text/event-stream')) {
        await processStream(response);
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          console.log("\nâœ… Response:");
          console.log("--------------------------------------------------");
          console.log(data.choices[0].message.content);
          console.log("--------------------------------------------------");
        } catch (e) {
          if (text.includes('data: ')) {
            // Server returned stream but no header
            await processStreamFromText(text);
          } else {
            throw new Error(`Failed to parse JSON: ${e.message}. Raw: ${text.substring(0, 100)}`);
          }
        }
      }
      return; 

    } catch (error) {
      console.error(`\x1b[31mâŒ Attempt ${attempt} failed: ${error.message}\x1b[0m`);
      if (attempt === maxRetries) {
        console.error("ðŸ’€ Max retries reached. Giving up.");
        process.exit(1);
      }
      const waitTime = Math.pow(2, attempt); // Exponential backoff
      console.log(`ðŸ”„ Retrying in ${waitTime}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
  }
}

runWithRetry();
