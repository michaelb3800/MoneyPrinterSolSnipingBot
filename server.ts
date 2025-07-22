import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { loadSettings } from './Settings';
import path from 'path';
import { Watcher } from './Watcher';
import { Classifier } from './Classifier';
import { Trader } from './Trader';
import { RiskManager } from './Risk';
import { SessionManager } from './Session';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Load and validate settings
// Allow overriding the settings file via the SETTINGS_PATH env var
const settingsPath = process.env.SETTINGS_PATH
  ? path.resolve(process.cwd(), process.env.SETTINGS_PATH)
  : path.resolve(process.cwd(), 'settings.json');
const settings = loadSettings(settingsPath);

// Instantiate core modules
const watcher = new Watcher(settings);
const classifier = new Classifier(settings);
const trader = new Trader(settings);
const risk = new RiskManager(settings);
const session = new SessionManager(settings);

let botActive = false;

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket: broadcast trade events
function broadcast(event: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(event));
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'connected', message: 'WebSocket connection established.' }));
});

// Wire up event flow
watcher.on('newPool', (pool) => {
  if (!botActive) return;
  classifier.classify(pool);
});

classifier.on('highScorePool', (pool) => {
  if (!botActive) return;
  if (!session.isWithinSchedule()) return;
  risk.checkBankroll();
  trader.buy(pool, settings.Settings.AmountToSpendSOL);
});

trader.on('trade', (tradeEvent) => {
  session.trackPosition(tradeEvent.position);
  broadcast({ event: 'trade', data: tradeEvent });
});

// Preset modes
const modePresets = {
  safe: {
    TakeProfitPercentage: 15,
    StopLossPercentage: 10,
    EntryLiquidity: 20000,
    ExitLiquidity: 15000,
    TokenAgeMaxHr: 0.1,
    Slippage: 2,
    RugCheckScore: 80,
  },
  turbo: {
    TakeProfitPercentage: 30,
    StopLossPercentage: 20,
    EntryLiquidity: 8000,
    ExitLiquidity: 5000,
    TokenAgeMaxHr: 0.5,
    Slippage: 5,
    RugCheckScore: 65,
  },
  yolo: {
    TakeProfitPercentage: 100,
    StopLossPercentage: 50,
    EntryLiquidity: 1000,
    ExitLiquidity: 500,
    TokenAgeMaxHr: 2,
    Slippage: 15,
    RugCheckScore: 0,
  },
};

type Mode = keyof typeof modePresets;

let currentMode = 'safe';
let customParams = {};

function applyMode(mode: Mode, params: Record<string, any> = {}) {
  const preset = modePresets[mode] || {};
  const merged = { ...preset, ...params };
  Object.assign(settings.Settings, merged);
}

// REST: Config endpoint
app.post('/printing/config', (req, res) => {
  const { mode, params } = req.body as { mode: Mode | 'custom'; params?: Record<string, any> };
  if (mode && mode !== 'custom' && modePresets[mode]) {
    currentMode = mode;
    customParams = {};
    applyMode(mode);
    return res.json({ status: 'ok', mode, params: modePresets[mode] });
  } else if (mode === 'custom' && params) {
    currentMode = 'custom';
    customParams = params;
    applyMode('safe', params); // Use safe as base for custom
    return res.json({ status: 'ok', mode: 'custom', params });
  } else {
    return res.status(400).json({ error: 'Invalid mode or params' });
  }
});

// REST: Start sniping bot
app.post('/printing/start', (req, res) => {
  if (botActive) return res.json({ status: 'already running' });
  botActive = true;
  watcher.start();
  res.json({ status: 'started', settings });
});

// REST: Stop sniping bot
app.post('/printing/stop', (req, res) => {
  if (!botActive) return res.json({ status: 'already stopped' });
  botActive = false;
  watcher.stop();
  res.json({ status: 'stopped' });
});

// REST: Status endpoint
app.get('/printing/status', (req, res) => {
  res.json({
    running: botActive,
    mode: currentMode,
    params: currentMode === 'custom' ? customParams : modePresets[currentMode as Mode],
    settings
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 
