import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { Settings } from './Settings';

export class Classifier extends EventEmitter {
  private settings: Settings;

  constructor(settings: Settings) {
    super();
    this.settings = settings;
  }

  async fetchRugCheck(mint: string): Promise<number> {
    try {
      const res = await fetch(`https://api.rugcheck.xyz/score/${mint}`);
      const data: any = await res.json();
      return data.score || 0;
    } catch {
      return 0;
    }
  }

  async fetchDexScreener(mint: string): Promise<{ liquidity: number }> {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      const data: any = await res.json();
      const liquidity = data.pairs?.[0]?.liquidity?.usd || 0;
      return { liquidity };
    } catch {
      return { liquidity: 0 };
    }
  }

  async fetchBirdeye(mint: string): Promise<{ price: number }> {
    try {
      const res = await fetch(`https://public-api.birdeye.so/public/price?address=${mint}`);
      const data: any = await res.json();
      return { price: data.data?.value || 0 };
    } catch {
      return { price: 0 };
    }
  }

  async fetchPumpFun(mint: string): Promise<{ isSpoof: boolean; ranked: boolean }> {
    try {
      const res = await fetch(`https://pump.fun/api/token/${mint}`);
      const data: any = await res.json();
      return { isSpoof: !!data.isSpoof, ranked: !!data.ranked };
    } catch {
      return { isSpoof: true, ranked: true };
    }
  }

  async fetchSolScan(mint: string): Promise<{ holders: number }> {
    try {
      const res = await fetch(`https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=1`);
      const data: any = await res.json();
      return { holders: data.total || 0 };
    } catch {
      return { holders: 99999 };
    }
  }

  async classify(pool: any) {
    const mint = pool.mint;
    // Parallel fetches
    const [rugScore, dex, birdeye, pump, solscan] = await Promise.all([
      this.fetchRugCheck(mint),
      this.fetchDexScreener(mint),
      this.fetchBirdeye(mint),
      this.fetchPumpFun(mint),
      this.fetchSolScan(mint),
    ]);

    // Thresholds (replace with settings-driven logic)
    if (
      rugScore >= 60 &&
      dex.liquidity >= this.settings.Settings.EntryLiquidity &&
      !pump.isSpoof &&
      !pump.ranked &&
      solscan.holders < 3000
    ) {
      this.emit('highScorePool', { ...pool, rugScore, liquidity: dex.liquidity });
    }
  }
} 
