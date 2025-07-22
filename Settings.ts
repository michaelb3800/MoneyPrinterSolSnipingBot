import { z } from 'zod';
import fs from 'fs';

export const SettingsSchema = z.object({
  Settings: z.object({
    APIKey: z.string(),
    APISecret: z.string(),
    'RPC-Mainnet': z.string().url(),
    'RPC-Devnet': z.string().url(),
    TestNet: z.boolean(),
    SimulatedTransaction: z.boolean(),
    PrivateKey: z.string(),
    BaseCurrency: z.literal('SOL'),
    AmountToSpendSOL: z.number(),
    AmountToSpendUSD: z.number(),
    AmountTokensToTrade: z.number().int(),
    TakeProfitPercentage: z.number(),
    StopLossPercentage: z.number(),
    EntryLiquidity: z.number(),
    ExitLiquidity: z.number(),
    TokenAgeMaxHr: z.number(),
    Slippage: z.number(),
    ScheduleTimeStart: z.string().regex(/^\d{2}:\d{2}$/),
    ScheduleTimeEnd: z.string().regex(/^\d{2}:\d{2}$/),
    Notifications: z.boolean(),
    BotToken: z.string(),
    ChatID: z.string(),
    SupabaseUrl: z.string().url().optional(),
    SupabaseKey: z.string().optional(),
    SlackWebhookUrl: z.string().url().optional(),
  })
});

export type Settings = z.infer<typeof SettingsSchema>;

export function loadSettings(path: string): Settings {
  const raw = fs.readFileSync(path, 'utf-8');
  const json = JSON.parse(raw);
  return SettingsSchema.parse(json);
}
