import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Settings } from './Settings';

export class Watcher extends EventEmitter {
  private ws: WebSocket | null = null;
  private settings: Settings;
  private reconnectAttempts = 0;
  private maxReconnects = 5;

  constructor(settings: Settings) {
    super();
    this.settings = settings;
  }

  start() {
    this.reconnectAttempts = 0;
    this.connect();
  }

  private connect() {
    const heliusKey = this.settings.Settings.APIKey;
    const useDevnet = this.settings.Settings.TestNet;
    const url = useDevnet
      ? `wss://devnet.laser.api.hel.io/v1/ws?api-key=${heliusKey}`
      : `wss://mainnet.laser.api.hel.io/v1/ws?api-key=${heliusKey}`;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.ws!.send(
        JSON.stringify({
          type: 'subscribe',
          channels: ['pools'],
        })
      );
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pool' && msg.event === 'create') {
          this.emit('newPool', msg.data);
        }
      } catch {
        // ignore parse errors
      }
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
      this.handleReconnect();
    });

    this.ws.on('close', () => {
      this.handleReconnect();
    });
  }

  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.emit('error', new Error('Watcher failed to reconnect'));
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), Math.min(1000 * this.reconnectAttempts, 10000));
  }
}
