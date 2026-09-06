# ⚡ Menos Code

**Premium AI Coding Assistant** — Powered by Laguna S 2.1 via OpenRouter

A free, self-hosted, GitHub Copilot-style AI coding assistant that runs on localhost:3000. Built with Node.js, featuring a sleek dark UI, real-time streaming responses, and an intelligent system prompt derived from state-of-the-art AI coding assistant architectures.

---

## ✨ Features

- 🎨 **GitHub Copilot-inspired UI** — Sleek black & white theme with smooth animations
- ⚡ **Real-time Streaming** — See responses as they're generated, token by token
- 🧠 **Advanced System Prompt** — Built from comprehensive AI coding assistant prompts
- 💬 **Multi-conversation** — Create, switch, and manage multiple chat sessions
- 🔍 **Code Highlighting** — Full syntax highlighting for 190+ languages
- 📋 **One-click Copy** — Copy any code block or full message instantly
- ⚙️ **Configurable** — Adjust temperature, max tokens, and more
- 💾 **Persistent Storage** — Conversations saved in browser localStorage
- 📱 **Responsive Design** — Works on desktop and mobile
- 🔒 **Hidden API Key** — Server-side API key, never exposed to client
- 🆓 **100% Free** — Uses Laguna S 2.1 free tier on OpenRouter

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key in .env
#    (Already configured with OpenRouter API key)

# 3. Start the server
npm start

# 4. Open in browser
#    http://localhost:3000
```

## 📁 Project Structure

```
menos-code/
├── .env                 # API keys & config (git-ignored)
├── .gitignore
├── package.json
├── server.js            # Express server + OpenRouter streaming API
├── public/
│   ├── index.html       # Main application shell
│   ├── style.css        # Premium dark theme styles
│   └── app.js           # Client-side application logic
└── README.md
```

## ⚙️ Configuration

Edit `.env` to customize:

```env
OPENROUTER_API_KEY=your-key-here
PORT=3000
MODEL_ID=poolside/laguna-s-2.1:free
```

## 🧠 System Prompt

The system prompt is built from comprehensive AI coding assistant architectures, incorporating:

- Advanced code generation and debugging instructions
- Security-aware coding practices
- Modern framework conventions
- Structured response formatting
- Step-by-step reasoning approach

## 🛠 Tech Stack

- **Backend**: Node.js + Express
- **AI Model**: Poolside Laguna S 2.1 (118B MoE, 8B active)
- **API Provider**: OpenRouter
- **Frontend**: Vanilla JS + Marked.js + Highlight.js
- **Font**: JetBrains Mono + Inter

## 📄 License

MIT — Free to use, modify, and distribute.

---

Built with ⚡ by **Menos Code**
