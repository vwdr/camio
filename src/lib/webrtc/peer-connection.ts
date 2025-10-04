// src/lib/webrtc/peer-connection.ts
import { SignalingServer } from './signaling-server';

interface PeerConnectionConfig {
  iceServers?: RTCIceServer[];
}

interface PeerConnectionCallbacks {
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onStreamEnded?: (reason: string) => void;
}

export class PeerConnection {
  private peerConnection: RTCPeerConnection;
  private signaling: SignalingServer;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteUserId: string | null = null;
  private callbacks: PeerConnectionCallbacks;
  private isInitiator: boolean = false;
  private connectionTimeout: number = 30000; // 30 seconds timeout for connections

  constructor(
    signaling: SignalingServer, 
    config: PeerConnectionConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    },
    callbacks: PeerConnectionCallbacks = {}
  ) {
    this.signaling = signaling;
    this.peerConnection = new RTCPeerConnection(config);
    this.callbacks = callbacks;

    this.setupPeerConnectionListeners();
    this.setupSignalingListeners();
  }

  private setupPeerConnectionListeners(): void {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.remoteUserId) {
        this.signaling.sendMessage(this.remoteUserId, 'ice-candidate', {
          candidate: event.candidate
        }).catch(error => {
          console.error('Error sending ICE candidate:', error);
          this.callbacks.onError?.(new Error(`Failed to send ICE candidate: ${error.message || String(error)}`));
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      
      // Handle connection failures
      if (this.peerConnection.connectionState === 'failed' || 
          this.peerConnection.connectionState === 'disconnected' || 
          this.peerConnection.connectionState === 'closed') {
        console.log('Connection was closed or failed');
      }
      
      if (this.callbacks.onConnectionStateChange) {
        this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.callbacks.onRemoteStream) {
          this.callbacks.onRemoteStream(this.remoteStream);
        }
      }
    };
    
    // Monitor ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
    };
    
    // Monitor signaling state
    this.peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', this.peerConnection.signalingState);
      
      if (this.peerConnection.signalingState === 'closed') {
        console.log('Signaling state closed');
      }
    };
  }

  private setupSignalingListeners(): void {
    this.signaling.onMessage(async (message: any) => {
      try {
        switch (message.type) {
          case 'offer':
            await this.handleOffer(message.data, message.sender);
            break;
          case 'answer':
            await this.handleAnswer(message.data);
            break;
          case 'ice-candidate':
            await this.handleIceCandidate(message.data);
            break;
          case 'disconnect':
            this.handleDisconnect();
            break;
          case 'stream-ended':
            this.handleStreamEnded(message.data?.reason || 'Stream ended by remote peer');
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling signaling message:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  /**
   * Initialize WebRTC as the caller (camera streamer)
   */
  async initializeAsStreamer(localStream: MediaStream, remoteUserId: string): Promise<void> {
    this.localStream = localStream;
    this.remoteUserId = remoteUserId;
    this.isInitiator = true;

    try {
      // Add tracks from local stream to peer connection
      const senders: RTCRtpSender[] = [];
      for (const track of this.localStream.getTracks()) {
        try {
          const sender = this.peerConnection.addTrack(track, this.localStream);
          senders.push(sender);
        } catch (trackErr: any) {
          console.error(`Error adding ${track.kind} track to peer connection:`, trackErr);
          throw new Error(`Failed to add media track: ${trackErr instanceof Error ? trackErr.message : String(trackErr)}`);
        }
      }
      
      if (senders.length === 0) {
        throw new Error('No media tracks could be added to the peer connection');
      }

      // Create an SDP offer
      let offer: RTCSessionDescriptionInit;
      try {
        offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
      } catch (offerErr: any) {
        console.error('Error creating SDP offer:', offerErr);
        throw new Error(`Failed to create SDP offer: ${offerErr instanceof Error ? offerErr.message : String(offerErr)}`);
      }
      
      // Set local description
      try {
        await this.peerConnection.setLocalDescription(offer);
      } catch (sdpErr: any) {
        console.error('Error setting local description:', sdpErr);
        throw new Error(`Failed to set local description: ${sdpErr instanceof Error ? sdpErr.message : String(sdpErr)}`);
      }
      
      // Ensure the local description is set before sending
      if (!this.peerConnection.localDescription) {
        throw new Error('Local description not set after setLocalDescription call');
      }

      // Send the offer to the remote peer
      try {
        await this.signaling.sendMessage(
          this.remoteUserId,
          'offer',
          { sdp: this.peerConnection.localDescription }
        );
        console.log("Sent SDP offer to viewer", this.remoteUserId);
      } catch (signalingErr: any) {
        console.error('Error sending offer through signaling server:', signalingErr);
        throw new Error(`Failed to send offer to viewer: ${signalingErr instanceof Error ? signalingErr.message : String(signalingErr)}`);
      }

      // Call the onLocalStream callback if provided
      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
    } catch (error: any) {
      console.error('Error initializing as streamer:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error(`Failed to initialize as streamer: ${error.message || String(error)}`));
      }
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Initialize this peer connection as the viewer (receiver)
   * @param streamerId The ID of the streamer to connect to
   * @returns A MediaStream object from the streamer
   */
  public async initializeAsViewer(streamerId: string): Promise<MediaStream> {
    this.remoteUserId = streamerId;
    
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let connectionTimedOut = false;
      let connectionEstablished = false;
      
      try {
        // Set up ontrack event handler to get the remote stream
        this.peerConnection.ontrack = (event) => {
          if (connectionTimedOut) return; // Ignore if we've already timed out
          
          console.log("Received remote track", event.track.kind);
          connectionEstablished = true;
          
          // Clear timeout since we got a track
          clearTimeout(timeoutId);
          
          // Check if the stream has video and audio
          const mediaStream = event.streams[0];
          if (!mediaStream) {
            reject(new Error('Received track but no media stream'));
            return;
          }
          
          if (mediaStream.getVideoTracks().length === 0) {
            console.warn('Connected to stream, but no video track found');
          }
          
          this.remoteStream = mediaStream;
          resolve(mediaStream);
        };
        
        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;
          console.log(`ICE connection state changed to ${state}`);
          
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            if (!connectionEstablished) {
              reject(new Error(`ICE connection failed: ${state}`));
              clearTimeout(timeoutId);
            } else if (this.callbacks.onConnectionStateChange) {
              this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
            }
          }
        };
        
        // Send a connection request to the streamer
        this.signaling.sendMessage(
          streamerId,
          'viewer-connect',
          { viewerId: this.signaling.getUserId() }
        ).catch((err: any) => {
          reject(new Error(`Failed to send connection request: ${err.message || String(err)}`));
        });
        
        console.log("Sent connection request to streamer", streamerId);
        
        // Set up a timeout in case we don't get a response
        timeoutId = setTimeout(() => {
          connectionTimedOut = true;
          console.log('Connection attempt timed out');
          reject(new Error('Connection timed out waiting for streamer response'));
        }, this.connectionTimeout);
        
      } catch (error: any) {
        console.error("Error in initializeAsViewer:", error);
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error(`Failed to initialize as viewer: ${error.message || String(error)}`));
        }
        reject(error);
      }
    });
  }

  /**
   * Handle an incoming WebRTC offer
   */
  private async handleOffer(data: any, senderId: string): Promise<void> {
    if (!this.remoteUserId) {
      this.remoteUserId = senderId;
    }

    try {
      if (!data || !data.sdp) {
        throw new Error('Invalid offer: missing SDP data');
      }
      
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log("Set remote description from offer");
      } catch (remoteDescErr: any) {
        console.error("Error setting remote description from offer:", remoteDescErr);
        throw new Error(`Failed to set remote description: ${remoteDescErr.message}`);
      }
      
      // Create answer
      let answer: RTCSessionDescriptionInit;
      try {
        answer = await this.peerConnection.createAnswer();
        console.log("Created answer");
      } catch (answerErr: any) {
        console.error("Error creating answer:", answerErr);
        throw new Error(`Failed to create answer: ${answerErr.message}`);
      }
      
      try {
        await this.peerConnection.setLocalDescription(answer);
        console.log("Set local description from answer");
      } catch (localDescErr: any) {
        console.error("Error setting local description from answer:", localDescErr);
        throw new Error(`Failed to set local description: ${localDescErr.message}`);
      }
      
      // Ensure we have a local description before sending
      if (!this.peerConnection.localDescription) {
        console.error("Local description not set after setLocalDescription");
        throw new Error('Local description not available for answer');
      }

      // Send the answer back
      try {
        await this.signaling.sendMessage(
          this.remoteUserId, 
          'answer',
          { sdp: this.peerConnection.localDescription }
        );
        console.log("Sent answer to offer");
      } catch (sendErr: any) {
        console.error("Error sending answer:", sendErr);
        throw new Error(`Failed to send answer: ${sendErr.message}`);
      }
    } catch (error: any) {
      console.error('Error handling offer:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Handle an incoming WebRTC answer
   */
  private async handleAnswer(data: any): Promise<void> {
    try {
      if (!data || !data.sdp) {
        throw new Error('Invalid answer: missing SDP data');
      }
      
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        console.log("Received answer and set remote description");
      } catch (remoteDescErr: any) {
        console.error("Error setting remote description from answer:", remoteDescErr);
        throw new Error(`Failed to set remote description from answer: ${remoteDescErr.message}`);
      }
    } catch (error: any) {
      console.error('Error handling answer:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Handle an incoming ICE candidate
   */
  private async handleIceCandidate(data: any): Promise<void> {
    try {
      if (data.candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log("Added ICE candidate");
        } catch (iceErr: any) {
          console.error("Error adding ICE candidate:", iceErr);
          throw new Error(`Failed to add ICE candidate: ${iceErr.message}`);
        }
      } else {
        console.warn("Received ice-candidate message without candidate data");
      }
    } catch (error: any) {
      console.error('Error handling ICE candidate:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Handle disconnect request
   */
  private handleDisconnect(): void {
    this.close();
  }
  
  /**
   * Handle stream ended message
   */
  private handleStreamEnded(reason: string): void {
    console.log("Stream ended by remote peer:", reason);
    if (this.callbacks.onStreamEnded) {
      this.callbacks.onStreamEnded(reason);
    }
    this.close();
  }

  /**
   * Close the peer connection and clean up resources
   */
  public close(): void {
    try {
      // Remove all event listeners
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      
      // Close the peer connection
      this.peerConnection.close();
      console.log('Peer connection closed successfully');
    } catch (error) {
      console.error("Error closing peer connection:", error);
    }
  }
}