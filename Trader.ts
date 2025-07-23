import { EventEmitter } from 'events';
import { Settings } from './Settings';
import { Keypair, Connection, Transaction, sendAndConfirmTransaction, PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';

export class Trader extends EventEmitter {
  private settings: Settings;

  constructor(settings: Settings) {
    super();
    this.settings = settings;
  }

  async getSOLPriceUSD(): Promise<number> {
    try {
      const res = await fetch('https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112');
      const data: any = await res.json();
      return data.data?.value || 0;
    } catch {
      return 0;
    }
  }

  async buildJupiterSwap(mint: string, amount: number) {
    // Jupiter API: https://quote-api.jup.ag/v6/quote
    try {
      const res = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mint}&amount=${amount * 1e9}&slippageBps=${this.settings.Settings.Slippage * 100}`);
      const data: any = await res.json();
      return data;
    } catch {
      return null;
    }
  }

  async signAndSendJitoBundle(tx: Transaction, connection: Connection, priorityFee: number): Promise<string> {
    const secretKey = bs58.decode(this.settings.Settings.PrivateKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    tx.feePayer = keypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    await tx.sign(keypair);

    const serialized = tx.serialize();
    const body = {
      transactions: [serialized.toString('base64')],
      priority_fee: priorityFee,
      broadcast: true,
    };

    const res = await fetch('https://block-engine.jito.wtf/api/v1/bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error('Jito bundle error: ' + (json.error || res.statusText));
    }

    return json.signature || json.bundleId;
  }

  async performPhantomSwap(fromMint: string, toMint: string, amount: number, slippage: number, priorityFee: number) {
    const connection = new Connection(this.settings.Settings['RPC-Mainnet']);
    const secretKey = bs58.decode(this.settings.Settings.PrivateKey);
    const keypair = Keypair.fromSecretKey(secretKey);
    const params = new URLSearchParams({
      from: fromMint,
      to: toMint,
      amount: amount.toString(), // amount in base units (SOL = 1, not lamports)
      slip: slippage.toString(),
      payer: keypair.publicKey.toBase58(),
      fee: priorityFee.toString(),
      txType: 'v0',
    });
    try {
      const response = await axios.get(`https://swap.solxtence.com/swap?${params}`);
      const { serializedTx, txType } = response.data.transaction;
      const { blockhash } = await connection.getLatestBlockhash();
      let transaction;
      if (txType === 'v0') {
        transaction = VersionedTransaction.deserialize(Buffer.from(serializedTx, 'base64'));
        transaction.message.recentBlockhash = blockhash;
        transaction.sign([keypair]);
      } else {
        transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
        transaction.recentBlockhash = blockhash;
        transaction.sign(keypair);
      }
      const signature = await sendAndConfirmTransaction(connection, transaction);
      return signature;
    } catch (error) {
      throw new Error('Phantom swap failed: ' + (error?.message || error));
    }
  }

  async buy(pool: any, amount: number) {
    const solPrice = await this.getSOLPriceUSD();
    const mint = pool.mint;
    if (this.settings.Settings.SimulatedTransaction) {
      // Simulate trade
      const position = {
        pool,
        amount,
        entryPrice: solPrice,
        timestamp: Date.now(),
        route: 'phantom',
        simulated: true,
      };
      this.emit('trade', { type: 'buy', position });
      return;
    }
    // Real trade: perform swap using Phantom wallet
    try {
      const sig = await this.performPhantomSwap(
        'So11111111111111111111111111111111111111112', // SOL
        mint,
        amount,
        this.settings.Settings.Slippage,
        0.00009 // default priority fee, can be made configurable
      );
      const position = {
        pool,
        amount,
        entryPrice: solPrice,
        timestamp: Date.now(),
        route: 'phantom',
        txSig: sig,
      };
      this.emit('trade', { type: 'buy', position });
    } catch (e) {
      this.emit('trade', { type: 'buy-failed', reason: (e as Error).message, pool });
    }
  }

  async sell(position: any, priorityFee: number = 0.00009) {
    const mint = position.pool.mint;
    const amount = position.amount;
    if (this.settings.Settings.SimulatedTransaction) {
      this.emit('trade', { type: 'sell', position });
      return;
    }
    try {
      // Swap from token back to SOL
      const sig = await this.performPhantomSwap(
        mint, // from token
        'So11111111111111111111111111111111111111112', // to SOL
        amount,
        this.settings.Settings.Slippage,
        priorityFee
      );
      this.emit('trade', { type: 'sell', position: { ...position, txSig: sig } });
    } catch (e) {
      // Fallback logic stub: try another DEX or route here in the future
      this.emit('trade', { type: 'sell-failed', reason: (e as Error).message, position });
    }
  }
} 
