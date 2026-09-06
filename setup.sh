#!/bin/bash
# Menos Code — Quick Setup Script
echo ""
echo "⚡ Menos Code Setup"
echo "════════════════════════════════"
echo ""

if [ -f .env ]; then
  echo "✅ .env already exists!"
  echo ""
  cat .env | grep -c "API_KEY" | xargs -I{} echo "   {} API keys configured"
  echo ""
  read -p "Overwrite? (y/N): " overwrite
  if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
    echo "Keeping existing .env"
    exit 0
  fi
fi

echo "📝 Enter your OpenRouter API keys (get free ones at https://openrouter.ai/settings/keys)"
echo "   You can add 1-10 keys. More keys = less rate limiting."
echo "   Press Enter with empty input to stop adding keys."
echo ""

KEYS=()
for i in $(seq 1 10); do
  read -p "   API Key #$i (or Enter to skip): " key
  if [ -z "$key" ]; then
    break
  fi
  KEYS+=("$key")
done

if [ ${#KEYS[@]} -eq 0 ]; then
  echo "❌ No keys provided. Exiting."
  exit 1
fi

# Write .env
echo "PORT=3000" > .env
echo "NODE_ENV=production" >> .env
for i in "${!KEYS[@]}"; do
  echo "API_KEY_$((i+1))=${KEYS[$i]}" >> .env
done

echo ""
echo "✅ .env created with ${#KEYS[@]} API key(s)"
echo ""
echo "🚀 Start the server:"
echo "   npm install"
echo "   npm start"
echo ""
echo "   Then open: http://localhost:3000"
echo ""
