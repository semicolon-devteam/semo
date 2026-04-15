/**
 * DiscordGateway — discord.js WebSocket client implementing GatewayAdapter.
 *
 * Receives Discord messages, filters them (bot mention / DM / bot-thread reply),
 * and exposes postAsBot via per-channel webhooks for bot persona posting.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  TextChannel,
  ThreadChannel,
  Webhook,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type Message,
  type Interaction,
  ChannelType,
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { GatewayAdapter, AskOption } from '@team-semicolon/semo-common';
import { splitDiscordMessage } from './markdown-to-discord.js';

// ── Types ──

export interface DiscordImage {
  name: string;
  media_type: string;
  localPath: string;
}

export interface DiscordMessage {
  text: string;
  user: string;
  channel: string;
  parentChannel?: string; // 부모 채널 ID (스레드인 경우, Router 서비스 매핑용)
  guildId?: string; // Discord 서버 ID (guild 단위 incubator 라우팅용)
  ts: string; // message ID
  thread_ts?: string; // thread (channel) ID if in thread
  images?: DiscordImage[];
}

export interface ThreadMessage {
  displayName: string;
  text: string;
  isBotMessage: boolean;
}

export type MessageHandler = (msg: DiscordMessage, senderName: string) => Promise<void>;

// ── Bot Profiles ──

const DISCORD_PROFILES: Record<string, { username: string; avatarURL?: string }> = {
  semiclaw: { username: 'SemiClaw' },
  planclaw: { username: 'PlanClaw' },
  designclaw: { username: 'DesignClaw' },
  workclaw: { username: 'WorkClaw' },
  reviewclaw: { username: 'ReviewClaw' },
  infraclaw: { username: 'InfraClaw' },
  growthclaw: { username: 'GrowthClaw' },
  incubator: { username: 'Incubator' },
};

// ── Supported image types ──

const SUPPORTED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

// ── Gateway ──

export class DiscordGateway implements GatewayAdapter {
  private client: Client;
  private botUserId = '';
  private onMessage: MessageHandler | null = null;

  // Bot thread tracking — same pattern as Slack
  private botThreads = new Map<string, number>();
  private readonly BOT_THREAD_TTL = 2 * 60 * 60_000; // 2 hours
  private readonly BOT_THREAD_MAX = 500;

  // Webhook cache per channel (TextChannel ID -> Webhook)
  private webhookCache = new Map<string, Webhook>();

  // ask_user pending responses
  private pendingAskResponses = new Map<string, (value: string) => void>();
  private askCounter = 0;

  // Guild-level allow list — all messages from these guilds are processed (e.g., incubator servers)
  private allowedGuilds = new Set<string>();

  // Busy state + queue (serial processing per thread)
  private busyThreads = new Set<string>();
  private busyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private messageQueue: Array<{ msg: DiscordMessage; senderName: string }> = [];
  private readonly BUSY_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

  constructor(private readonly token: string) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler;
  }

  setAllowedGuilds(guildIds: string[]): void {
    this.allowedGuilds = new Set(guildIds);
  }

  async start(): Promise<void> {
    // Register event handlers before login
    this.client.on(Events.MessageCreate, (message) => this.handleMessageCreate(message));
    this.client.on(Events.InteractionCreate, (interaction) => this.handleInteraction(interaction));

    await this.client.login(this.token);

    // Wait for ready
    await new Promise<void>((resolve) => {
      if (this.client.isReady()) {
        this.botUserId = this.client.user!.id;
        resolve();
      } else {
        this.client.once(Events.ClientReady, (c) => {
          this.botUserId = c.user.id;
          console.log(`[discord] Logged in as ${c.user.tag} (${c.user.id})`);
          resolve();
        });
      }
    });
  }

  // ── Message Handling ──

  private async handleMessageCreate(message: Message): Promise<void> {
    // Ignore own messages
    if (message.author.id === this.botUserId) return;
    // Ignore other bot messages
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(this.botUserId);
    const isDM =
      message.channel.type === ChannelType.DM || message.channel.type === ChannelType.GroupDM;
    const isThread =
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread;
    const isBotThreadReply = isThread && this.isBotThreadCached(message.channel.id);

    const isAllowedGuild = !!message.guildId && this.allowedGuilds.has(message.guildId);

    // Filter: only process bot mentions, DMs, replies in bot-tracked threads, or allowed guild messages
    if (!isMentioned && !isDM && !isBotThreadReply && !isAllowedGuild) return;

    // Track thread if bot was mentioned
    if (isMentioned) {
      const threadKey = isThread ? message.channel.id : message.id;
      this.trackBotThread(threadKey);
    }

    // Clean text: remove bot mention
    const cleanText = message.content
      .replace(new RegExp(`<@!?${this.botUserId}>\\s*`, 'g'), '')
      .trim();
    if (!cleanText && (!message.attachments || message.attachments.size === 0)) return;

    // Add :eyes: reaction + typing indicator
    try {
      await message.react('\uD83D\uDC40'); // eyes emoji
    } catch {
      /* already reacted or missing permissions */
    }
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
    } catch {
      /* typing indicator failure is non-fatal */
    }

    // Download image attachments
    const images = await this.downloadImages(message);

    // Determine thread context
    let threadId: string | undefined;
    let responseChannel: string;

    if (isThread) {
      threadId = message.channel.id;
      responseChannel = message.channel.id;
    } else if (isMentioned && !isDM) {
      // Channel mention — create thread for response
      try {
        const thread = await message.startThread({
          name: `SemoBot - ${message.author.displayName}`,
        });
        threadId = thread.id;
        responseChannel = thread.id;
        this.trackBotThread(thread.id);
      } catch {
        // Thread creation failed (e.g., already in thread) — reply in channel
        threadId = undefined;
        responseChannel = message.channelId;
      }
    } else {
      // DM
      responseChannel = message.channelId;
    }

    const senderName =
      message.member?.displayName || message.author.displayName || message.author.username;

    // parentChannelId: Router의 서비스 매핑에 사용 (스레드가 아닌 실제 채널 ID)
    const parentChannelId = isThread
      ? (message.channel as ThreadChannel).parentId || message.channelId
      : message.channelId;

    const discordMsg: DiscordMessage = {
      text: cleanText || '(image)',
      user: message.author.id,
      channel: responseChannel,
      parentChannel: parentChannelId,
      guildId: message.guildId || undefined,
      ts: message.id,
      thread_ts: threadId,
      ...(images.length > 0 && { images }),
    };

    const threadKey = threadId || message.id;

    // Busy check — queue if thread is busy
    if (this.busyThreads.has(threadKey)) {
      this.messageQueue.push({ msg: discordMsg, senderName });
      return;
    }

    this.busyThreads.add(threadKey);
    this.busyTimers.set(
      threadKey,
      setTimeout(() => {
        console.error(`[discord] busy timeout for thread ${threadKey} — auto-clearing`);
        this.busyThreads.delete(threadKey);
        this.busyTimers.delete(threadKey);
      }, this.BUSY_TIMEOUT_MS),
    );

    try {
      if (this.onMessage) await this.onMessage(discordMsg, senderName);
    } finally {
      this.busyThreads.delete(threadKey);
      const timer = this.busyTimers.get(threadKey);
      if (timer) {
        clearTimeout(timer);
        this.busyTimers.delete(threadKey);
      }
      // Process queued messages for this thread
      const nextIdx = this.messageQueue.findIndex(
        (q) => (q.msg.thread_ts || q.msg.ts) === threadKey,
      );
      if (nextIdx >= 0) {
        const next = this.messageQueue.splice(nextIdx, 1)[0];
        setImmediate(() => {
          if (this.onMessage) {
            const handler = this.onMessage;
            handler(next.msg, next.senderName).catch((err) =>
              console.error('[discord] queued message handler error:', err),
            );
          }
        });
      }
    }
  }

  // ── Image Download ──

  private async downloadImages(message: Message): Promise<DiscordImage[]> {
    const images: DiscordImage[] = [];
    if (!message.attachments || message.attachments.size === 0) return images;

    const tmpDir = path.join(os.tmpdir(), 'semo-discord-images');
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const [, attachment] of message.attachments) {
      const contentType = attachment.contentType || '';
      if (!SUPPORTED_IMAGE_MIMES.has(contentType)) continue;
      if (attachment.size > MAX_IMAGE_BYTES) {
        console.log(
          `[discord-gw] Skipping oversized image: ${attachment.name} (${(attachment.size / 1024 / 1024).toFixed(1)}MB)`,
        );
        continue;
      }

      try {
        const res = await fetch(attachment.url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = contentType.split('/')[1] || 'png';
        const localPath = path.join(tmpDir, `${message.id}-${attachment.id}.${ext}`);
        fs.writeFileSync(localPath, buf);
        images.push({
          name: attachment.name || 'image',
          media_type: contentType,
          localPath,
        });
      } catch {
        // Download failed — skip
      }
    }

    return images;
  }

  // ── GatewayAdapter Implementation ──

  async postAsBot(botId: string, channel: string, text: string, threadTs?: string): Promise<void> {
    const profile = DISCORD_PROFILES[botId] || { username: botId };
    const chunks = splitDiscordMessage(text);

    // Determine the target channel for webhook posting
    const targetChannel = await this.client.channels.fetch(threadTs || channel);
    if (!targetChannel) {
      console.error(`[discord-gw] Channel not found: ${threadTs || channel}`);
      return;
    }

    // Get the parent text channel for webhook (threads use parent's webhook)
    let textChannel: TextChannel;
    let threadId: string | undefined;

    if (
      targetChannel.type === ChannelType.PublicThread ||
      targetChannel.type === ChannelType.PrivateThread
    ) {
      const parent = (targetChannel as ThreadChannel).parent;
      if (!parent || !(parent instanceof TextChannel)) {
        // Fallback: post as bot directly
        await this.postAsBotDirect(targetChannel as ThreadChannel, botId, chunks);
        return;
      }
      textChannel = parent;
      threadId = targetChannel.id;
    } else if (targetChannel instanceof TextChannel) {
      textChannel = targetChannel;
    } else {
      // DM or unsupported channel type — post directly via bot
      if ('send' in targetChannel) {
        for (const chunk of chunks) {
          await (targetChannel as { send: (opts: { content: string }) => Promise<unknown> }).send({
            content: chunk,
          });
        }
      }
      return;
    }

    // Get or create webhook
    const webhook = await this.getOrCreateWebhook(textChannel);

    for (const chunk of chunks) {
      await webhook.send({
        content: chunk,
        username: profile.username,
        ...(profile.avatarURL && { avatarURL: profile.avatarURL }),
        ...(threadId && { threadId }),
      });
    }

    // Track thread after successful post
    if (threadId) this.trackBotThread(threadId);
    if (threadTs) this.trackBotThread(threadTs);
  }

  /** Fallback: post directly via bot when webhook is unavailable */
  private async postAsBotDirect(
    channel: ThreadChannel,
    botId: string,
    chunks: string[],
  ): Promise<void> {
    const profile = DISCORD_PROFILES[botId] || { username: botId };
    for (const chunk of chunks) {
      await channel.send({
        content: `**[${profile.username}]** ${chunk}`,
      });
    }
  }

  private async getOrCreateWebhook(channel: TextChannel): Promise<Webhook> {
    const cached = this.webhookCache.get(channel.id);
    if (cached) return cached;

    // Try to find existing SemoBot webhook
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find((w) => w.name === 'SemoBot' && w.owner?.id === this.botUserId);

    if (!webhook) {
      // Create new webhook
      webhook = await channel.createWebhook({
        name: 'SemoBot',
        reason: 'SEMO multi-bot persona posting',
      });
    }

    this.webhookCache.set(channel.id, webhook);
    return webhook;
  }

  async setTypingStatus(channel: string, _threadTs: string, _status: string): Promise<void> {
    try {
      const ch = await this.client.channels.fetch(channel);
      if (ch && 'sendTyping' in ch) {
        await (ch as TextChannel).sendTyping();
      }
    } catch {
      /* non-fatal */
    }
  }

  async addReaction(channel: string, messageId: string, emoji: string): Promise<void> {
    try {
      const ch = await this.client.channels.fetch(channel);
      if (ch && 'messages' in ch) {
        const msg = await (ch as TextChannel).messages.fetch(messageId);
        await msg.react(emoji);
      }
    } catch {
      /* non-fatal */
    }
  }

  // ── Thread History ──

  async getThreadHistory(channelId: string, limit = 15): Promise<ThreadMessage[]> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !('messages' in channel)) return [];

      const messages = await (channel as TextChannel).messages.fetch({ limit: limit + 1 });
      // Remove the latest message (current), keep rest as history
      const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      const history = sorted.slice(0, -1);

      return history.map((m) => ({
        displayName: m.member?.displayName || m.author.displayName || m.author.username,
        text: m.content.length > 500 ? m.content.slice(0, 500) + '...(truncated)' : m.content,
        isBotMessage: m.author.bot,
      }));
    } catch {
      return [];
    }
  }

  // ── Ask User (Interactive Buttons) ──

  async askUser(
    botId: string,
    channelId: string,
    question: string,
    options: AskOption[],
    threadId?: string,
  ): Promise<string> {
    const requestId = `ask_${++this.askCounter}_${Date.now()}`;
    const profile = DISCORD_PROFILES[botId] || { username: botId };

    const buttons = options
      .slice(0, 4)
      .map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`semo_ask_${requestId}_${i}`)
          .setLabel(opt.label)
          .setStyle(ButtonStyle.Primary),
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    // Buttons must be sent via bot API (not webhook)
    const targetChannelId = threadId || channelId;
    const channel = await this.client.channels.fetch(targetChannelId);
    if (!channel || !('send' in channel)) {
      return '(channel not found)';
    }

    await (channel as TextChannel).send({
      content: `**[${profile.username}]** ${question}`,
      components: [row],
    });

    return new Promise<string>((resolve) => {
      this.pendingAskResponses.set(requestId, resolve);
      setTimeout(() => {
        if (this.pendingAskResponses.has(requestId)) {
          this.pendingAskResponses.delete(requestId);
          resolve('(timeout -- no response within 120s)');
        }
      }, 120_000);
    });
  }

  // ── Interaction Handler (Button Clicks) ──

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const match = interaction.customId.match(/^semo_ask_(.+)_\d+$/);
    if (!match) return;

    const requestId = match[1];
    const resolve = this.pendingAskResponses.get(requestId);
    if (!resolve) {
      await interaction.reply({ content: 'This button has expired.', ephemeral: true });
      return;
    }

    this.pendingAskResponses.delete(requestId);
    const selectedLabel =
      ('label' in interaction.component && interaction.component.label) || 'selected';
    resolve(selectedLabel);

    try {
      await interaction.update({
        content: `Selected: **${selectedLabel}** (by ${interaction.user.displayName})`,
        components: [],
      });
    } catch {
      // Update failed — response was still delivered
      try {
        await interaction.reply({
          content: `Selected: **${selectedLabel}**`,
          ephemeral: true,
        });
      } catch {
        /* exhausted fallback */
      }
    }
  }

  // ── Bot Thread Tracking ──

  private trackBotThread(threadId: string): void {
    this.botThreads.delete(threadId);
    this.botThreads.set(threadId, Date.now());
    if (this.botThreads.size > this.BOT_THREAD_MAX) {
      const oldest = this.botThreads.keys().next().value;
      if (oldest) this.botThreads.delete(oldest);
    }
  }

  private isBotThreadCached(threadId: string): boolean {
    const lastActive = this.botThreads.get(threadId);
    if (!lastActive) return false;
    if (Date.now() - lastActive > this.BOT_THREAD_TTL) {
      this.botThreads.delete(threadId);
      return false;
    }
    // LRU refresh
    this.botThreads.delete(threadId);
    this.botThreads.set(threadId, Date.now());
    return true;
  }

  // ── Lifecycle ──

  async stop(): Promise<void> {
    this.client.destroy();
  }
}
