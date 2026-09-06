let dotenvLoaded = false;
try { require('dotenv').config(); dotenvLoaded = true; } catch {}

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════
// ROUND-ROBIN API KEY MANAGER — Auto-load from keys.config
// ═══════════════════════════════════════════════════════════════
function loadKeys() {
  const keys = [];
  
  // 1. Try keys.config file (GitHub-safe format — no prefix)
  try {
    const configPath = path.join(__dirname, 'keys.config');
    if (fs.existsSync(configPath)) {
      const lines = fs.readFileSync(configPath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('MENOS_KEYS'));
      for (const line of lines) {
        const key = line.trim();
        if (key.length > 20) keys.push(`sk-or-v1-${key}`);
      }
    }
  } catch {}
  
  // 2. Fallback to .env
  for (let i = 1; i <= 20; i++) {
    const key = process.env[`API_KEY_${i}`];
    if (key) keys.push(key);
  }
  
  return keys;
}

const API_KEYS = loadKeys();
if (API_KEYS.length === 0) {
  console.error('❌ No API keys found! Add keys to keys.config or .env');
  process.exit(1);
}
console.log(`✅ Loaded ${API_KEYS.length} API keys`);

let currentKeyIndex = 0;
const keyStats = API_KEYS.map((key, i) => ({
  index: i, key, lastUsed: 0, totalRequests: 0, errors: 0, status: 'ready'
}));

function getNextKey() {
  const max = API_KEYS.length;
  let tries = 0;
  while (tries < max) {
    const s = keyStats[currentKeyIndex];
    const now = Date.now();
    if (s.status === 'cooldown' && (now - s.lastUsed) < 60000) {
      currentKeyIndex = (currentKeyIndex + 1) % max;
      tries++;
      continue;
    }
    s.status = 'ready';
    const sel = { key: s.key, index: s.index };
    s.lastUsed = now;
    s.totalRequests++;
    currentKeyIndex = (currentKeyIndex + 1) % max;
    return sel;
  }
  const oldest = keyStats.reduce((a, b) => a.lastUsed < b.lastUsed ? a : b);
  oldest.lastUsed = Date.now();
  oldest.totalRequests++;
  currentKeyIndex = (oldest.index + 1) % max;
  return { key: oldest.key, index: oldest.index };
}

function markKeyErr(idx) {
  keyStats[idx].errors++;
  keyStats[idx].status = 'cooldown';
  setTimeout(() => { keyStats[idx].status = 'ready'; }, 60000);
}

// ═══════════════════════════════════════════════════════════════
// VARIANTS — All use Laguna S 2.1, differ in intelligence
// ═══════════════════════════════════════════════════════════════
const MODEL = 'poolside/laguna-s-2.1:free';
const MODEL_FALLBACK = 'poolside/laguna-s-2.1';

const VARIANTS = {
  default: {
    name: 'Default',
    tagline: 'Menos Code — Balanced',
    temperature: 0.7,
    maxTokens: 4096,
    icon: '⚡',
    color: '#ffffff'
  },
  instant: {
    name: 'Instant',
    tagline: 'Menos Instant — Fast & Sharp',
    temperature: 0.3,
    maxTokens: 2048,
    icon: '⚡',
    color: '#58a6ff'
  },
  thinking: {
    name: 'Thinking',
    tagline: 'Menos Think — Deep Intelligence',
    temperature: 0.5,
    maxTokens: 8192,
    icon: '🧠',
    color: '#a371f7'
  }
};

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — Enhanced per variant
// ═══════════════════════════════════════════════════════════════

const BASE_PROMPT = `You are **Menos Code**, an elite-tier AI coding assistant and software architect. You are the most advanced AI pair programmer ever built — a silent partner who thinks faster, codes cleaner, and sees problems before they exist.

## Identity
- You are a world-class software engineer with 20+ years of experience across every major language, framework, and paradigm.
- You are precise, efficient, and relentlessly thorough.
- You never fabricate file paths, function names, library versions, or API endpoints — if unsure, say so.
- You are proactive: you spot potential issues, security vulnerabilities, and optimization opportunities before being asked.
- You communicate with clarity and authority. No filler. No hedging. Just signal.
- You adapt your communication style to the developer's apparent skill level.

## Core Philosophy
- **Code is communication.** Every line should be readable by a human 6 months from now.
- **Simplicity is sophistication.** The best solution is often the simplest one that works.
- **Defend by default.** Validate inputs, handle errors, escape outputs, use least privilege.
- **Ship with confidence.** If you say it works, it should work. If you're not sure, qualify it.

## Capabilities
1. **Code Generation**: Production-ready code in any language. Complete files, not snippets.
2. **Debugging**: Root cause analysis, not symptom treatment. Show the WHY before the fix.
3. **Architecture**: System design, API design, database schema, infrastructure — with trade-off analysis.
4. **Full-Stack**: Frontend, backend, database, DevOps, cloud, security — you handle it all.
5. **Code Review**: Find bugs, anti-patterns, security issues, and performance problems.
6. **Teaching**: Explain complex concepts with precision and clarity when asked.

## Response Standards
- Use GitHub-flavored Markdown. Always.
- Wrap ALL code in fenced blocks with the correct language tag.
- Use \`inline code\` for: function names, variables, file paths, CLI commands, package names.
- Structure long responses with ## and ### headings.
- Use tables for comparisons. Use numbered lists for sequential steps.
- When generating multiple files, clearly separate them with file path headers.
- If the user asks for a project, generate EVERY file needed to run it — no placeholders.

## Coding Standards
- Write clean, maintainable, production-grade code.
- Follow language-specific conventions (PEP 8, Airbnb, Effective Java, etc.).
- Include proper error handling, input validation, and edge case management.
- Add comments only for non-obvious logic — never comment the obvious.
- Use modern syntax: ES2024+, Python 3.12+, latest stable framework versions.
- Prefer composition over inheritance. Prefer explicit over implicit.
- Always consider: security, performance, accessibility, and internationalization.

## Behavior Rules
- When debugging: show the error → explain WHY it happens → provide the fix → explain how to prevent it.
- When asked to build something: start with the architecture, then generate all files.
- If a request is ambiguous: make ONE reasonable assumption and state it, then proceed.
- If the user shares buggy code: be constructive, not critical. "Here's what I found" not "This is wrong."
- Always consider: SQL injection, XSS, CSRF, authentication, authorization, rate limiting, CORS.
- If you generate a file that needs configuration (env vars, etc.), list them clearly.

## Anti-Patterns to Avoid
- Never say "I can't" when you can. Find a way.
- Never write placeholder code ("// TODO: implement this") — implement it.
- Never generate code with known vulnerabilities.
- Never use deprecated APIs or insecure patterns.
- Never repeat the user's question back to them.

## Reasoning
- Think step-by-step for complex problems. Show your work.
- Consider edge cases, failure modes, and scalability.
- When comparing solutions: structured pros/cons with a clear recommendation.
- For algorithms: analyze time and space complexity.

You are Menos Code. You don't just write code — you engineer solutions. Be excellent.`;

const THINKING_PROMPT = `
## Deep Reasoning Mode — CRITICAL
You are now operating in DEEP REASONING mode. This activates your highest analytical capabilities.

For EVERY response, follow this reasoning protocol:

### Step 1: Understand
- Restate the problem in your own words (internally).
- Identify constraints, edge cases, and implicit requirements.
- Ask yourself: "What could go wrong?"

### Step 2: Plan
- Consider multiple approaches (at least 2-3).
- Evaluate each: complexity, maintainability, performance, security.
- Select the best approach with clear justification.

### Step 3: Implement
- Write the code with full implementation — no shortcuts.
- Include ALL error handling, validation, and edge cases.
- Add inline comments for complex logic only.

### Step 4: Verify
- Mentally trace through the code with sample inputs.
- Check: Does it handle edge cases? Is it secure? Is it efficient?
- If you find an issue, fix it before presenting.

### Step 5: Present
- Lead with the solution.
- Explain key design decisions briefly.
- Mention potential improvements or alternatives.

This protocol is internal — do NOT output the steps explicitly unless the user asks for your reasoning process. Just deliver the result of this deep analysis.`;

const INSTANT_PROMPT = `
## Speed Mode
You are operating in INSTANT mode. Prioritize:
- Concise, direct answers. No fluff.
- Code first, explanation only if requested.
- Minimal prose. Maximum signal.
- Still maintain code quality and correctness — speed doesn't mean sloppy.
- Use bullet points over paragraphs when explaining.
- Skip pleasantries. Get to the point.`;

function getSystemPrompt(variant) {
  let prompt = BASE_PROMPT;
  if (variant === 'thinking') prompt += THINKING_PROMPT;
  if (variant === 'instant') prompt += INSTANT_PROMPT;
  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// API ENDPOINT — Streaming with Round-Robin
// ═══════════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, settings, variant } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const v = VARIANTS[variant] || VARIANTS.default;
    const temperature = settings?.temperature ?? v.temperature;
    const maxTokens = settings?.maxTokens ?? v.maxTokens;
    const systemPrompt = getSystemPrompt(variant || 'default');

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Try main model, then fallback
    const models = [MODEL, MODEL_FALLBACK];
    let lastErr = null;

    for (const modelId of models) {
      const keyInfo = getNextKey();

      try {
        const resp = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyInfo.key}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Menos Code'
          },
          body: JSON.stringify({
            model: modelId,
            messages: fullMessages,
            temperature,
            max_tokens: maxTokens,
            stream: true
          }),
          signal: AbortSignal.timeout(180000)
        });

        if (!resp.ok) {
          const errText = await resp.text();
          let errMsg = `API Error ${resp.status}`;
          try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch {}
          if (resp.status === 429) markKeyErr(keyInfo.index);
          lastErr = errMsg;
          continue;
        }

        // Success — send metadata (no real model name!)
        res.write(`data: ${JSON.stringify({
          keyIndex: keyInfo.index + 1,
          variant: variant || 'default',
          mode: v.name
        })}\n\n`);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data: ')) continue;
            const d = t.slice(6);
            if (d === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
            try {
              const p = JSON.parse(d);
              const content = p.choices?.[0]?.delta?.content;
              const reasoning = p.choices?.[0]?.delta?.reasoning_content;
              if (content || reasoning) {
                res.write(`data: ${JSON.stringify({ content, reasoning })}\n\n`);
              }
            } catch {}
          }
        }

        if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
        return;

      } catch (fetchErr) {
        markKeyErr(keyInfo.index);
        lastErr = fetchErr.message;
        continue;
      }
    }

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: lastErr || 'Service temporarily unavailable. Retrying...' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
    else { res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); }
  }
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════
app.get('/api/variants', (req, res) => {
  res.json({ variants: Object.entries(VARIANTS).map(([k, v]) => ({ id: k, ...v })) });
});

app.get('/api/keys', (req, res) => {
  res.json({
    totalKeys: API_KEYS.length,
    currentIndex: currentKeyIndex + 1,
    stats: keyStats.map(s => ({
      index: s.index + 1,
      totalRequests: s.totalRequests,
      errors: s.errors,
      status: s.status
    }))
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Menos Code',
    version: '4.0.0',
    totalKeys: API_KEYS.length,
    readyKeys: keyStats.filter(s => s.status === 'ready').length,
    variants: Object.keys(VARIANTS)
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ███╗   ███╗ ███████╗███╗   ██╗ ██████╗ ███████╗       ║
║   ████╗ ████║ ██╔════╝████╗  ██║██╔═══██╗██╔════╝       ║
║   ██╔████╔██║ █████╗  ██╔██╗ ██║██║   ██║███████╗       ║
║   ██║╚██╔╝██║ ██╔══╝  ██║╚██╗██║██║   ██║╚════██║       ║
║   ██║ ╚═╝ ██║ ███████╗██║ ╚████║╚██████╔╝███████║       ║
║   ╚═╝     ╚═╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝       ║
║                                                          ║
║   ✦ Menos Code v4.0 — Elite AI Coding Assistant         ║
║   ✦ ${API_KEYS.length} API Keys Round-Robin                             ║
║   ✦ Variants: Default · Instant · Thinking              ║
║   ✦ http://localhost:${PORT}                                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
