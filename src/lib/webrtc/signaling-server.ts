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
      // Clean up existing subscription first
      if (this.subscription) {
        console.log('🧹 Cleaning up existing subscription for:', this.userId);
        await this.supabase.removeChannel(this.subscription);
        this.subscription = null;
      }

      // Subscribe to a shared broadcast channel for all signaling
      console.log('🔗 Setting up broadcast subscription for userId:', this.userId);
      this.subscription = this.supabase
        .channel(`signaling:${this.channel}`) // Shared channel for all users
        .on(
          'broadcast',
          { event: 'signaling-message' },
          (payload: { payload: SignalingMessage }) => {
          console.log('🔥 SUBSCRIPTION TRIGGERED for userId:', this.userId, 'payload:', {
            messageType: payload.payload?.type,
            sender: payload.payload?.sender,
            recipient: payload.payload?.recipient
          });
          
          if (payload.payload && payload.payload.recipient === this.userId) {
            console.log('📥 RAW MESSAGE RECEIVED:', {
              type: payload.payload.type,
              sender: payload.payload.sender, 
              recipient: payload.payload.recipient,
              myUserId: this.userId,
              isForMe: payload.payload.recipient === this.userId
            });
            
            try {
              // Broadcast payload already contains the structured message
              const message: SignalingMessage = payload.payload;

              console.log('🔔 PROCESSING MESSAGE:', message.type, 'from:', message.sender);

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
        .subscribe((status, err) => {
          console.log('🔄 Subscription status change:', status, 'for userId:', this.userId);
          if (err) {
            console.error('❌ Subscription error:', err);
          }
        });

      console.log('📡 Subscription created for:', this.userId, 'channel:', `signaling:${this.channel}`);
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

    if (!this.subscription) {
      throw new Error('Not connected to signaling server');
    }

    try {
      // Use the existing subscription channel to broadcast
      const message: SignalingMessage = {
        type,
        sender: this.userId,
        recipient: recipientId,
        data
      };

      const result = await this.subscription.send({
        type: 'broadcast',
        event: 'signaling-message',
        payload: message
      });

      console.log('💾 BROADCAST SENT:', {
        type,
        sender: this.userId,
        recipient: recipientId,
        success: result === 'ok'
      });

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