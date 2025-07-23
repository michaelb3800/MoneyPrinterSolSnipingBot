import { Settings } from './Settings';
import Redis from 'ioredis';
import fetch from 'node-fetch';

export class RiskManager {
  private settings: Settings;
  private redis: Redis | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  checkBankroll() {
    const bankroll = this.settings.Settings.AmountToSpendSOL * this.settings.Settings.AmountTokensToTrade;
    console.log('Bankroll per wallet:', bankroll);
  }

  async isKillSwitchActive(): Promise<boolean> {
    // Check Redis
    if (this.redis) {
      const val = await this.redis.get('sniper-kill-switch');
      if (val === 'true') return true;
    }
    // Check Supabase table `bot_control` for a kill action
    if (this.settings.Settings.SupabaseUrl && this.settings.Settings.SupabaseKey) {
      try {
        const url = `${this.settings.Settings.SupabaseUrl}/rest/v1/bot_control?select=action&order=id.desc&limit=1`;
        const res = await fetch(url, {
          headers: {
            apikey: this.settings.Settings.SupabaseKey,
            Authorization: `Bearer ${this.settings.Settings.SupabaseKey}`,
          },
        });
        const data: any = await res.json();
        if (Array.isArray(data) && data[0]?.action) {
          const action = data[0].action.toString().toLowerCase();
          if (action === 'kill' || action === 'stop' || action === 'off') return true;
        }
      } catch {
        // ignore Supabase errors
      }
    }
    // Check env
    if (process.env.KILL_SWITCH === 'true') return true;
    return false;
  }

  async panicAlert(reason: string) {
    // Telegram
    if (this.settings.Settings.Notifications && this.settings.Settings.BotToken && this.settings.Settings.ChatID) {
      await fetch(`https://api.telegram.org/bot${this.settings.Settings.BotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.settings.Settings.ChatID,
          text: `PANIC ALERT: ${reason}`,
        }),
      });
    }
    // Slack
    if (this.settings.Settings.SlackWebhookUrl) {
      await fetch(this.settings.Settings.SlackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `PANIC ALERT: ${reason}` }),
      });
    }
    console.error('PANIC ALERT:', reason);
  }

  // Trailing stop-loss logic (stub)
  checkTrailingStop(position: any, currentPrice: number): boolean {
    const pct = (this.settings.Settings as any).TrailingStopPercentage;
    if (!pct) return false;

    if (!position.highestPrice) {
      position.highestPrice = position.entryPrice || currentPrice;
      position.trailingStop = position.highestPrice * (1 - pct / 100);
      return false;
    }

    if (currentPrice > position.highestPrice) {
      position.highestPrice = currentPrice;
      position.trailingStop = currentPrice * (1 - pct / 100);
    }

    if (position.trailingStop && currentPrice <= position.trailingStop) {
      return true;
    }

    return false;
  }
}
