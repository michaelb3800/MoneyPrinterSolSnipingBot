import { Trader } from './Trader';
import { Watcher } from './Watcher';
import { Classifier } from './Classifier';
import { RiskManager } from './Risk';
import { SessionManager } from './Session';
import { Settings, SettingsSchema } from './Settings';
import EventEmitter from 'events';
import baseSettings from './settings.json';

export interface MoneyPrinterBotOptions {
  privateKey: string;
  params?: Partial<Settings['Settings']>;
  onTrade?: (event: any) => void;
  onError?: (err: any) => void;
}

export class MoneyPrinterBot extends EventEmitter {
  private settings: Settings;
  private watcher: Watcher;
  private classifier: Classifier;
  private trader: Trader;
  private risk: RiskManager;
  private session: SessionManager;
  private active: boolean = false;

  constructor({ privateKey, params = {}, onTrade, onError }: MoneyPrinterBotOptions) {
    super();
    // Load default settings and override with params
    const settings = JSON.parse(JSON.stringify(baseSettings));
    settings.Settings.PrivateKey = privateKey;
    Object.assign(settings.Settings, params);
    this.settings = SettingsSchema.parse(settings);
    this.watcher = new Watcher(this.settings);
    this.classifier = new Classifier(this.settings);
    this.trader = new Trader(this.settings);
    this.risk = new RiskManager(this.settings);
    this.session = new SessionManager(this.settings, this.trader);
    if (onTrade) this.trader.on('trade', onTrade);
    if (onError) this.on('error', onError);
    // Wire up event flow
    this.watcher.on('newPool', (pool) => {
      if (!this.active) return;
      this.classifier.classify(pool);
    });
    this.classifier.on('highScorePool', (pool) => {
      if (!this.active) return;
      if (!this.session.isWithinSchedule()) return;
      this.risk.checkBankroll();
      this.trader.buy(pool, this.settings.Settings.AmountToSpendSOL);
    });
    this.trader.on('trade', (tradeEvent) => {
      this.session.trackPosition(tradeEvent.position);
      this.emit('trade', tradeEvent);
    });
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.watcher.start();
    this.emit('status', { running: true });
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.watcher.stop();
    this.emit('status', { running: false });
  }

  status() {
    return {
      running: this.active,
      settings: this.settings,
      openPositions: this.session.getOpenPositions(),
    };
  }

  setConfig(params: Partial<Settings['Settings']>) {
    Object.assign(this.settings.Settings, params);
  }
}

// Multi-user manager (optional)
export class MoneyPrinterBotManager {
  private bots: Map<string, MoneyPrinterBot> = new Map();

  startBot(userId: string, opts: MoneyPrinterBotOptions) {
    if (this.bots.has(userId)) return this.bots.get(userId);
    const bot = new MoneyPrinterBot(opts);
    bot.start();
    this.bots.set(userId, bot);
    return bot;
  }

  stopBot(userId: string) {
    const bot = this.bots.get(userId);
    if (bot) {
      bot.stop();
      this.bots.delete(userId);
    }
  }

  getBot(userId: string) {
    return this.bots.get(userId);
  }

  status(userId: string) {
    const bot = this.bots.get(userId);
    return bot ? bot.status() : null;
  }
} 
