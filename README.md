# MoneyPrinter's One‑Tap Solana Sniping Bot

## Integrating MoneyPrinterBot into Your Backend

MoneyPrinterBot is designed for seamless integration into any Node.js/TypeScript backend. You can start, stop, and monitor a trading bot for any user with just a few lines of code. Each bot instance trades using the user's Phantom wallet (private key) and your chosen parameters.

### 1. Install Dependencies

```
npm install @solana/web3.js bs58 axios node-fetch zod
```

### 2. Project Structure
- Place all core files (`Trader`, `Watcher`, `Classifier`, `Risk`, `Session`, `Settings`, `moneyPrinterBot.ts`) in your backend project directory.
- Ensure you have a `settings.json` file with your default config (see below).

### 3. Usage Example: Single User

```js
import { MoneyPrinterBot } from './moneyPrinterBot';

const bot = new MoneyPrinterBot({
  privateKey: 'USER_PHANTOM_PRIVATE_KEY', // base58 string
  params: {
    AmountToSpendSOL: 1,
    Slippage: 5,
    // ...any other overrides
  },
  onTrade: (tradeEvent) => {
    console.log('Trade event:', tradeEvent);
  },
  onError: (err) => {
    console.error('Bot error:', err);
  }
});

bot.start();
// ...
bot.stop();
```

### 4. Usage Example: Multi-User (Recommended for SaaS)

```js
import { MoneyPrinterBotManager } from './moneyPrinterBot';

const manager = new MoneyPrinterBotManager();

// Start a bot for a user
manager.startBot('user123', {
  privateKey: 'USER1_PRIVATE_KEY',
  params: { AmountToSpendSOL: 2 }
});

// Start another bot for a different user
manager.startBot('user456', {
  privateKey: 'USER2_PRIVATE_KEY',
  params: { AmountToSpendSOL: 0.5 }
});

// Stop a user's bot
manager.stopBot('user123');

// Get status
console.log(manager.status('user456'));
```

### 5. settings.json Example

```json
{
  "Settings": {
    "APIKey": "your_helius_api_key",
    "APISecret": "your_helius_api_secret",
    "RPC-Mainnet": "https://api.mainnet-beta.solana.com",
    "RPC-Devnet": "https://api.devnet.solana.com",
    "TestNet": false,
    "SimulatedTransaction": true,
    "PrivateKey": "", // Will be set per user
    "BaseCurrency": "SOL",
    "AmountToSpendSOL": 1.0,
    "AmountToSpendUSD": 10.0,
    "AmountTokensToTrade": 3,
    "TakeProfitPercentage": 25.0,
    "StopLossPercentage": 15.0,
    "EntryLiquidity": 10000.0,
    "ExitLiquidity": 6000.0,
    "TokenAgeMaxHr": 0.33,
    "Slippage": 7,
    "ScheduleTimeStart": "12:03",
    "ScheduleTimeEnd": "12:04",
    "Notifications": false,
    "BotToken": "your_telegram_bot_token",
    "ChatID": "your_telegram_chat_id",
    "SupabaseUrl": "https://your-project.supabase.co",
    "SupabaseKey": "your_supabase_service_role_key"
  }
}
```

### 6. Security Best Practices
- **Never log or persist user private keys.**
- **Encrypt keys in transit and at rest.**
- **Run each bot instance in a sandboxed process or container if possible.**
- **Validate all user input and config.**

### 7. Advanced: Event Handling & Customization
- Subscribe to the `trade` event for real-time trade updates.
- Use the `setConfig()` method to update parameters on the fly.
- Use the `status()` method to get current bot state and open positions.

### 8. Troubleshooting
- Ensure all dependencies are installed.
- Check your `settings.json` for required fields.
- Make sure your backend has network access to Solana RPC and swap APIs.

---

> **Developer Note:**
> See the section [Integrating the Bot with Your App UI](#integrating-the-bot-with-your-app-ui) for step-by-step instructions and code examples on how to connect your frontend or backend to this bot for one-tap sniping.

## Overview
A production-ready, low-latency Solana sniping bot triggered by a single REST call or via Supabase. All behavior is driven by a JSON settings object. The bot trades directly from a Phantom (or Passkey) wallet and is designed for integration with your app backend.

---

## Integrating the Bot with Your App UI

You can control and monitor the bot from any frontend or backend with just a few lines of code. This enables true "one-tap" sniping from your app's UI.

### 1. REST API Integration
- **Start the bot:**
  ```js
  fetch('http://<your-server>:3000/printing/start', { method: 'POST' });
  ```
- **Stop the bot:**
  ```js
  fetch('http://<your-server>:3000/printing/stop', { method: 'POST' });
  ```
- **Check status:**
  ```js
  fetch('http://<your-server>:3000/printing/status')
    .then(res => res.json())
    .then(console.log);
  ```
- **Set mode or custom parameters:**
  ```js
  // Safe mode
  fetch('http://<your-server>:3000/printing/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'safe' })
  });
  // Turbo mode
  fetch('http://<your-server>:3000/printing/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'turbo' })
  });
  // Yolo mode
  fetch('http://<your-server>:3000/printing/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'yolo' })
  });
  // Custom mode
  fetch('http://<your-server>:3000/printing/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'custom', params: { TakeProfitPercentage: 50, Slippage: 10 } })
  });
  ```

### 2. WebSocket for Real-Time Updates
- **Connect to the WebSocket:**
  ```js
  const ws = new WebSocket('ws://<your-server>:3000');
  ws.onmessage = (msg) => console.log('Bot event:', msg.data);
  ```
- You will receive trade events, status updates, and more in real time.

### 3. Supabase Integration (Optional)
- If your backend uses Supabase, you can control the bot by writing to a `bot_control` table (see Supabase Integration section below).

### 4. Example: One-Tap Button in React
```jsx
<button onClick={() => fetch('http://<your-server>:3000/printing/start', { method: 'POST' })}>
  Start Sniping Bot
</button>
<button onClick={() => fetch('http://<your-server>:3000/printing/stop', { method: 'POST' })}>
  Stop Sniping Bot
</button>
```

---

## Modes: Safe, Turbo, Yolo, and Custom

The bot supports three preset modes and a custom mode for easy configuration:

- **Safe Mode:** Conservative, high-safety settings (high RugCheck, high liquidity, low slippage, conservative TP/SL)
- **Turbo Mode:** Balanced, moderate risk/reward
- **Yolo Mode:** Aggressive, high-risk/high-reward, minimal safety checks
- **Custom:** Set your own parameters for full control

You can switch modes or set custom parameters at any time using the `/printing/config` endpoint (see above).

The current mode and parameters are always available via `/printing/status`.

---

## Features
- **Ultra-fast pool sniping** via Helius LaserStream (with Geyser fallback)
- **Token safety and liquidity checks** (RugCheck, DexScreener, Birdeye, Pump.fun, SolScan)
- **Automated trading** using Jupiter, Raydium, Orca, and Jito Block-Engine
- **Take-profit, stop-loss, and trailing SL**
- **Bankroll and risk controls**
- **Telegram notifications** (optional)
- **Supabase integration** for state, trades, and remote control
- **REST and WebSocket API** for app backend integration
- **Docker-ready**

---

## Architecture

```
Watcher (LaserStream) → Classifier (APIs) → Trader (Jupiter/Jito) → Session (Positions/Supabase) → Risk (Controls)
```

- **watcher/**: Listens for new pools on Solana via Helius LaserStream (WebSocket)
- **classifier/**: Fetches and aggregates token safety/liquidity metrics from RugCheck, DexScreener, Birdeye, Pump.fun, and SolScan
- **trader/**: Builds and submits swaps using Jupiter, Raydium, Orca, and Jito Block-Engine; handles signing
- **session/**: Tracks open positions, enforces schedule, syncs with Supabase
- **risk/**: Bankroll, kill-switch, and panic alert logic
- **api/**: REST endpoints and WebSocket server for app integration
- **config/**: Zod schema for settings validation

---

## API Integrations
- **Helius LaserStream**: Real-time pool detection
- **QuickNode Geyser**: Fallback for pool detection
- **RugCheck**: Token safety score
- **DexScreener**: Liquidity and price
- **Birdeye**: Price and live price stream
- **Pump.fun**: Spoof/rank checks
- **SolScan**: Holder count
- **Jupiter**: Swap route builder
- **Raydium/Orca**: Fallback DEXes
- **Jito Block-Engine**: Bundle submission
- **Supabase**: State, trades, and remote control
- **Telegram**: Notifications (if enabled)

---

## Supabase Integration
- **Store trades, positions, and bot state** in Supabase tables
- **Control bot (start/stop/config)** via Supabase (for your app backend)
- **Sync open positions** between bot and Supabase
- **Example tables:**
  - `positions` (id, mint, amount, entryPrice, timestamp, ...)
  - `trades` (id, type, positionId, pnl, timestamp, ...)
  - `bot_control` (id, action, config, timestamp)

---

## Configuration

All settings are in `settings.json` (see `settings.example.json`):

```json
{
  "Settings": {
    "APIKey": "your_helius_api_key",
    "APISecret": "your_helius_api_secret",
    "RPC-Mainnet": "https://api.mainnet-beta.solana.com",
    "RPC-Devnet": "https://api.devnet.solana.com",
    "TestNet": false,
    "SimulatedTransaction": true,
    "PrivateKey": "your_base58_private_key",
    "BaseCurrency": "SOL",
    "AmountToSpendSOL": 1.0,
    "AmountToSpendUSD": 10.0,
    "AmountTokensToTrade": 3,
    "TakeProfitPercentage": 25.0,
    "StopLossPercentage": 15.0,
    "EntryLiquidity": 10000.0,
    "ExitLiquidity": 6000.0,
    "TokenAgeMaxHr": 0.33,
    "Slippage": 7,
    "ScheduleTimeStart": "12:03",
    "ScheduleTimeEnd": "12:04",
    "Notifications": false,
    "BotToken": "your_telegram_bot_token",
    "ChatID": "your_telegram_chat_id",
    "SupabaseUrl": "https://your-project.supabase.co",
    "SupabaseKey": "your_supabase_service_role_key"
  }
}
```

---

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure settings:**
   - Copy `settings.example.json` to `settings.json` and fill in your values.
3. **(Optional) Set up Supabase:**
   - Create tables: `positions`, `trades`, `bot_control` (see above)
   - Add your Supabase URL and Key to `settings.json`
4. **Run the server:**
   ```bash
   npx ts-node api/server.ts
   ```
   The server will start on port 3000 by default.

---

## Usage

### Standalone (REST & WebSocket)
- **Start the bot:**
  ```bash
  curl -X POST http://localhost:3000/printing/start
  ```
- **Stop the bot:**
  ```bash
  curl -X POST http://localhost:3000/printing/stop
  ```
- **WebSocket:**
  Connect to `ws://localhost:3000` to receive trade events.

### Supabase-Driven (for App Backend)
- **Control the bot** by inserting actions into the `bot_control` table (e.g., `{ action: 'start' }`)
- **Monitor trades and positions** by subscribing to `trades` and `positions` tables
- **Sync config** by updating the config in Supabase and reloading the bot

---

## Integration with Your App Backend
- **REST API:** Call `/printing/start` and `/printing/stop` to control the bot
- **WebSocket:** Stream trade events to your app UI
- **Supabase:** Use as a bridge for state, trades, and remote control
- **Custom logic:** Extend the bot to listen for Supabase changes and auto-reload config or respond to app actions

---

## Docker

1. **Build and run with Docker:**
   ```bash
   docker build -t solsnipingbot .
   docker run -d --env-file .env -p 3000:3000 solsnipingbot
   ```
2. **Or use docker-compose:**
   ```bash
   docker-compose up --build
   ```

---

## How the Bot Works

1. **Watcher** connects to Helius LaserStream and emits new pool events in real time.
2. **Classifier** fetches all required metrics and only passes pools that meet all safety/liquidity thresholds.
3. **Trader** builds a swap route (Jupiter, Raydium, Orca), signs, and submits the transaction (Jito bundle).
4. **Session** tracks open positions, enforces schedule, and syncs with Supabase.
5. **Risk** module enforces bankroll, kill-switch, and panic alerts.
6. **API** exposes REST and WebSocket endpoints for your app backend.

---

## Extending and Customizing
- Add more DEXes or custom logic in `trader/`
- Add more risk controls or notifications in `risk/`
- Add more analytics or reporting in `session/`
- Integrate with your app backend via REST, WebSocket, or Supabase

---

## Support
For questions or help, open an issue or contact the project maintainer.
