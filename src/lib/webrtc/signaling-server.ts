// src/lib/webrtc/signaling-server.ts
import type { RealtimeChannel, RealtimePostgresInsertPayload, SupabaseClient } from '@supabase/supabase-js';
import type { SignalingMessage, JsonValue } from './types';

interface SignalingMessageRow {
  id: string;
  channel: string;
  message_type: string;
  sender: string;
  recipient: string;
  data: JsonValue | null;
  created_at: string;
}

type SignalingCallback = (message: SignalingMessage) => void;

export class SignalingServer {
  private supabase: SupabaseClient;
  private userId: string;
  private channel: string;
  // Support multiple listeners so different subsystems (pairing flow, peer connections)
  // can receive messages concurrently.
  private onMessageCallbacks: SignalingCallback[] = [];
  private subscription: RealtimeChannel | null = null;

  constructor(supabaseClient: SupabaseClient, userId: string, channel: string = 'webrtc-signaling') {
    this.supabase = supabaseClient;
    this.userId = userId;
    this.channel = channel;
  }

  /**
   * Initialize the signaling server and subscribe to messages
   */
  async connect(): Promise<void> {
    try {
      // Create or check if the channel exists
      const { error } = await this.supabase
        .from('signaling_channels')
        .upsert({ channel_name: this.channel }, { onConflict: 'channel_name' });

      if (error) {
        console.error('Error connecting to signaling channel:', error);
        throw error;
      }

      // Subscribe to realtime updates for this channel
      this.subscription = this.supabase
        .channel(`signaling:${this.channel}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'signaling_messages',
          filter: `recipient=eq.${this.userId}`,
  }, (payload: RealtimePostgresInsertPayload<SignalingMessageRow>) => {
          if (payload.new) {
            try {
              // Normalize data: may already be an object (jsonb) or a JSON string
              const raw = payload.new.data;
              const normalizedData = typeof raw === 'string'
                ? (() => { try { return JSON.parse(raw); } catch { return { value: raw }; } })()
                : (raw ?? {});

              const message: SignalingMessage = {
                type: payload.new.message_type,
                sender: payload.new.sender,
                recipient: payload.new.recipient,
                data: normalizedData as Record<string, unknown>
              };

              // fan-out to all listeners
              for (const cb of this.onMessageCallbacks) {
                try {
                  cb(message);
                } catch (cbErr) {
                  console.error('Signaling onMessage callback error:', cbErr);
                }
              }
            } catch (error) {
              console.error('Error handling signaling message payload:', error);
            }
          }
        })
        .subscribe();

      console.log(`Connected to signaling channel: ${this.channel}`);
    } catch (error) {
      console.error('Error setting up signaling server:', error);
      throw error;
    }
  }

  /**
   * Send a signaling message to another user
   */
  async sendMessage(
    recipientId: string,
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!recipientId) {
      console.error('Cannot send message: No recipient ID provided');
      return;
    }

    try {
      // Ensure data is JSON-serializable and store as proper jsonb
      let jsonPayload: Record<string, unknown> = {};
      try {
        // This will deep-clone only serializable values
        jsonPayload = data == null ? {} : JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
      } catch (err) {
        console.warn('Non-serializable data passed to sendMessage; sending empty object instead', err);
        jsonPayload = {};
      }

      const { error } = await this.supabase
        .from('signaling_messages')
        .insert({
          message_type: type,
          sender: this.userId,
          recipient: recipientId,
          data: jsonPayload,
          channel: this.channel,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error sending signaling message:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * Listen for incoming signaling messages
   */
  onMessage(callback: (message: SignalingMessage) => void): void {
    // Add listener; allow multiple registrations
    this.onMessageCallbacks.push(callback);
  }

  offMessage(callback: (message: SignalingMessage) => void): void {
    this.onMessageCallbacks = this.onMessageCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    if (this.subscription) {
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }
    this.onMessageCallbacks = [];
    console.log('Disconnected from signaling server');
  }
  
  /**
   * Get the user ID for this signaling server
   */
  getUserId(): string {
    return this.userId;
  }
}