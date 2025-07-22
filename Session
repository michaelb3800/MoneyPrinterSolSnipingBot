import { Settings } from './Settings';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SessionManager {
  private openPositions: any[] = [];
  private settings: Settings;
  private supabase: SupabaseClient | null = null;
  private priceWatchers: Map<string, NodeJS.Timeout> = new Map();
  private trader: any; // Will be set in constructor

  constructor(settings: Settings, trader?: any) {
    this.settings = settings;
    if (settings.Settings.SupabaseUrl && settings.Settings.SupabaseKey) {
      this.supabase = createClient(settings.Settings.SupabaseUrl, settings.Settings.SupabaseKey);
    }
    if (trader) this.trader = trader;
  }

  isWithinSchedule(): boolean {
    const now = new Date();
    const [startH, startM] = this.settings.Settings.ScheduleTimeStart.split(':').map(Number);
    const [endH, endM] = this.settings.Settings.ScheduleTimeEnd.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);
    const end = new Date(now);
    end.setHours(endH, endM, 59, 999);
    return now >= start && now <= end;
  }

  async trackPosition(position: any) {
    this.openPositions.push(position);
    if (this.supabase) {
      await this.supabase.from('positions').insert([position]);
    }
    // Start price watcher for this position
    if (this.trader) this.startPriceWatcher(position);
  }

  async closePosition(position: any) {
    this.openPositions = this.openPositions.filter((p) => p !== position);
    if (this.supabase && position.id) {
      await this.supabase.from('positions').delete().eq('id', position.id);
    }
    // Stop price watcher
    if (position && position.timestamp) {
      const key = position.timestamp.toString();
      if (this.priceWatchers.has(key)) {
        clearInterval(this.priceWatchers.get(key));
        this.priceWatchers.delete(key);
      }
    }
  }

  getOpenPositions() {
    return this.openPositions;
  }

  async loadPositionsFromSupabase() {
    if (this.supabase) {
      const { data } = await this.supabase.from('positions').select('*');
      this.openPositions = data || [];
    }
  }

  // --- New: Price watcher and auto-sell logic ---
  startPriceWatcher(position: any) {
    const key = position.timestamp.toString();
    let highestPrice = position.entryPrice;
    let trailingStop = highestPrice; // Initialize as number
    const poll = async () => {
      // Fetch current price for the token
      const mint = position.pool.mint;
      let price = 0;
      try {
        const res = await fetch(`https://public-api.birdeye.so/public/price?address=${mint}`);
        const data = await res.json();
        price = data.data?.value || 0;
      } catch {}
      // Take-Profit
      if (
        this.settings.Settings.TakeProfitPercentage &&
        price >= position.entryPrice * (1 + this.settings.Settings.TakeProfitPercentage / 100)
      ) {
        this.trader.sell(position);
        this.closePosition(position);
        return;
      }
      // Stop-Loss
      if (
        this.settings.Settings.StopLossPercentage &&
        price <= position.entryPrice * (1 - this.settings.Settings.StopLossPercentage / 100)
      ) {
        this.trader.sell(position);
        this.closePosition(position);
        return;
      }
      // Trailing Stop-Loss
      if (this.settings.Settings.TrailingStopPercentage) {
        if (price > highestPrice) highestPrice = price;
        trailingStop = highestPrice * (1 - this.settings.Settings.TrailingStopPercentage / 100);
        if (price < trailingStop) {
          this.trader.sell(position);
          this.closePosition(position);
          return;
        }
      }
    };
    const interval = setInterval(poll, 5000); // Poll every 5 seconds
    this.priceWatchers.set(key, interval);
  }
} 
