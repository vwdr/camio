// src/lib/webrtc/signaling-server.ts
import { createClient } from '@supabase/supabase-js';

interface SignalingMessage {
  type: string;
  sender: string;
  recipient: string;
  data: any;
}

export class SignalingServer {
  private supabase;
  private userId: string;
  private channel: string;
  private onMessageCallback: ((message: SignalingMessage) => void) | null = null;
  private subscription: any = null;

  constructor(supabaseClient: any, userId: string, channel: string = 'webrtc-signaling') {
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
      const { data: channel, error } = await this.supabase
        .from('signaling_channels')
        .upsert({ channel_name: this.channel }, { onConflict: 'channel_name' })
        .select();

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
        }, (payload: any) => {
          if (this.onMessageCallback && payload.new) {
            try {
              // Parse the message data
              const message: SignalingMessage = {
                type: payload.new.message_type,
                sender: payload.new.sender,
                recipient: payload.new.recipient,
                data: JSON.parse(payload.new.data || '{}')
              };
              
              this.onMessageCallback(message);
            } catch (error) {
              console.error('Error parsing signaling message:', error);
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
  async sendMessage(recipientId: string, type: string, data: any): Promise<void> {
    if (!recipientId) {
      console.error('Cannot send message: No recipient ID provided');
      return;
    }

    try {
      // Ensure data is JSON serializable
      let serializedData;
      try {
        serializedData = JSON.stringify(data || {});
      } catch (err) {
        console.error('Error serializing message data:', err);
        serializedData = '{}';
      }

      const { error } = await this.supabase
        .from('signaling_messages')
        .insert({
          message_type: type,
          sender: this.userId,
          recipient: recipientId,
          data: serializedData,
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
    this.onMessageCallback = callback;
  }

  /**
   * Disconnect from the signaling server
   */
  disconnect(): void {
    if (this.subscription) {
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }
    this.onMessageCallback = null;
    console.log('Disconnected from signaling server');
  }
  
  /**
   * Get the user ID for this signaling server
   */
  getUserId(): string {
    return this.userId;
  }
}