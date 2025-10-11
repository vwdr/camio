// src/lib/webrtc/peer-connection.ts
import { SignalingServer } from './signaling-server';
import type {
  AnswerPayload,
  IceCandidatePayload,
  OfferPayload,
  SignalingMessage,
  StreamEndedPayload,
  ViewerConnectPayload,
} from './types';

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isOfferPayload = (value: unknown): value is OfferPayload =>
  isRecord(value) && 'sdp' in value;

const isAnswerPayload = (value: unknown): value is AnswerPayload =>
  isRecord(value) && 'sdp' in value;

const isIceCandidatePayload = (value: unknown): value is IceCandidatePayload =>
  isRecord(value) && 'candidate' in value;

const isViewerConnectPayload = (value: unknown): value is ViewerConnectPayload =>
  isRecord(value) && typeof value.viewerId === 'string';

const isStreamEndedPayload = (value: unknown): value is StreamEndedPayload =>
  !value || (isRecord(value) && (value.reason === undefined || typeof value.reason === 'string'));

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
  private rtcConfig: RTCConfiguration;
  private localStream: MediaStream | null = null;
  private localTracksAdded = false;
  private localSenders: RTCRtpSender[] = [];
  private remoteStream: MediaStream | null = null;
  private remoteUserId: string | null = null;
  private callbacks: PeerConnectionCallbacks;
  private isInitiator: boolean = false;
  private connectionTimeout: number = 30000; // 30 seconds timeout for connections
  private iceCandidateQueue: RTCIceCandidate[] = [];

  constructor(
    signaling: SignalingServer, 
    config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    },
    callbacks: PeerConnectionCallbacks = {}
  ) {
    this.signaling = signaling;
    this.rtcConfig = config;
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.callbacks = callbacks;

    this.setupPeerConnectionListeners();
    this.setupSignalingListeners();
  }

  private recreatePeerConnection(): void {
    try {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.onsignalingstatechange = null;
      this.peerConnection.close();
    } catch (error) {
      console.warn('Error while resetting peer connection:', error);
    }

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.localTracksAdded = false;
    this.localSenders = [];
    this.remoteStream = null;
    this.remoteUserId = null;
    this.iceCandidateQueue = [];

    this.setupPeerConnectionListeners();

    if (this.localStream && this.callbacks.onLocalStream) {
      this.callbacks.onLocalStream(this.localStream);
    }
  }

  private setupPeerConnectionListeners(): void {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate:', event.candidate.candidate.substring(0, 50) + '...');
        if (this.remoteUserId) {
          this.signaling.sendMessage(this.remoteUserId, 'ice-candidate', {
            candidate: event.candidate
          }).catch(error => {
            console.error('Error sending ICE candidate:', error);
            this.callbacks.onError?.(new Error(`Failed to send ICE candidate: ${error.message || String(error)}`));
          });
        } else {
          console.warn('⚠️ ICE candidate generated but no remoteUserId set yet');
        }
      } else {
        console.log('🧊 ICE gathering complete (null candidate)');
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
    
    // Monitor ICE connection state separately
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
      if (this.peerConnection.iceConnectionState === 'connected' || this.peerConnection.iceConnectionState === 'completed') {
        console.log('✅ ICE connection established!');
      } else if (this.peerConnection.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed!');
      }
    };
    
    // Monitor ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', this.peerConnection.iceGatheringState);
    };
    
    // Monitor signaling state
    this.peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', this.peerConnection.signalingState);
      
      if (this.peerConnection.signalingState === 'closed') {
        console.log('❌ Signaling state closed');
      }
    };
  }

  private async processIceCandidateQueue(): Promise<void> {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log('Processed queued ICE candidate.');
        } catch (error) {
          console.error('Error adding queued ICE candidate:', error);
          this.callbacks.onError?.(new Error(`Failed to add queued ICE candidate: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }
  }

  private setupSignalingListeners(): void {
    this.signaling.onMessage(async (message) => {
      try {
        switch (message.type) {
          case 'offer':
            if (isOfferPayload(message.data)) {
              await this.handleOffer(message.data, message.sender);
            } else {
              console.warn('Received malformed offer payload', message.data);
            }
            break;
          case 'answer':
            if (isAnswerPayload(message.data)) {
              await this.handleAnswer(message.data);
            } else {
              console.warn('Received malformed answer payload', message.data);
            }
            break;
          case 'ice-candidate':
            if (isIceCandidatePayload(message.data)) {
              await this.handleIceCandidate(message.data);
            } else {
              console.warn('Received malformed ICE candidate payload', message.data);
            }
            break;
          case 'viewer-connect':
            await this.handleViewerConnect(message);
            break;
          case 'disconnect':
            this.handleDisconnect();
            break;
          case 'stream-ended':
            if (isStreamEndedPayload(message.data)) {
              const reason = typeof message.data?.reason === 'string'
                ? message.data.reason
                : 'Stream ended by remote peer';
              this.handleStreamEnded(reason);
            } else {
              this.handleStreamEnded('Stream ended by remote peer');
            }
            break;
          case 'streamer-info':
          case 'streamer-info-request':
          case 'register-camera':
          case 'register-ack':
            // Ignore these - they're handled by higher-level components
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling signaling message:', error);
        this.callbacks.onError?.(normalizeError(error));
      }
    });
  }

  private async handleViewerConnect(message: SignalingMessage): Promise<void> {
    console.log('📨 Received viewer-connect message from', message.sender);
    
    if (!this.localStream) {
      console.warn('⚠️ Received viewer-connect but no local stream is attached');
      return;
    }

    if (!isViewerConnectPayload(message.data)) {
      console.warn('⚠️ Viewer connect message missing payload');
      return;
    }

    const requestedViewerId = message.data.viewerId || message.sender;
    if (!requestedViewerId) {
      console.warn('⚠️ Viewer connect message missing viewerId');
      return;
    }

    try {
      console.log('🎥 Processing viewer-connect from', requestedViewerId, '- initializing as streamer');
      await this.initializeAsStreamer(this.localStream, requestedViewerId);
      console.log('✅ Successfully initialized streamer for viewer', requestedViewerId);
    } catch (err) {
      console.error('❌ Failed to initialize streamer peer connection:', err);
      this.callbacks.onError?.(normalizeError(err));
    }
  }

  /**
   * Initialize WebRTC as the caller (camera streamer)
   */
  async initializeAsStreamer(localStream: MediaStream, remoteUserId: string): Promise<void> {
    console.log('🎬 initializeAsStreamer called for viewer:', remoteUserId);
    console.log('Current state - connection:', this.peerConnection.connectionState, 'signaling:', this.peerConnection.signalingState);
    console.log('Current remoteUserId:', this.remoteUserId, 'tracks added:', this.localTracksAdded);
    
    // Only reset if we're connecting to a DIFFERENT viewer or connection is completely broken
    const needsReset = (this.remoteUserId && this.remoteUserId !== remoteUserId) ||
      this.peerConnection.connectionState === 'failed' ||
      this.peerConnection.connectionState === 'closed';

    if (needsReset) {
      console.log('⚠️ Resetting peer connection - switching viewers or connection failed');
      this.recreatePeerConnection();
    }

    this.localStream = localStream;
    this.remoteUserId = remoteUserId;
    this.isInitiator = true;

    try {
      const tracks = this.localStream.getTracks();
      if (tracks.length === 0) {
        throw new Error('No media tracks available to share with viewers');
      }

      if (!this.localTracksAdded) {
        this.localSenders = [];
        for (const track of tracks) {
          try {
            const sender = this.peerConnection.addTrack(track, this.localStream);
            this.localSenders.push(sender);
          } catch (trackErr: unknown) {
            const normalized = normalizeError(trackErr);
            console.error(`Error adding ${track.kind} track to peer connection:`, normalized);
            throw new Error(`Failed to add media track: ${normalized.message}`);
          }
        }

        if (this.localSenders.length === 0) {
          throw new Error('No media tracks could be added to the peer connection');
        }

        this.localTracksAdded = true;
      }

      // Create an SDP offer
      let offer: RTCSessionDescriptionInit;
      try {
        offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
      } catch (offerErr: unknown) {
        const normalized = normalizeError(offerErr);
        console.error('Error creating SDP offer:', normalized);
        throw new Error(`Failed to create SDP offer: ${normalized.message}`);
      }
      
      // Set local description
      try {
        await this.peerConnection.setLocalDescription(offer);
      } catch (sdpErr: unknown) {
        const normalized = normalizeError(sdpErr);
        console.error('Error setting local description:', normalized);
        throw new Error(`Failed to set local description: ${normalized.message}`);
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
          { sdp: this.peerConnection.localDescription as RTCSessionDescriptionInit }
        );
        console.log('Sent SDP offer to viewer', this.remoteUserId);
      } catch (signalingErr: unknown) {
        const normalized = normalizeError(signalingErr);
        console.error('Error sending offer through signaling server:', normalized);
        throw new Error(`Failed to send offer to viewer: ${normalized.message}`);
      }

      // Call the onLocalStream callback if provided
      if (this.callbacks.onLocalStream) {
        this.callbacks.onLocalStream(this.localStream);
      }
    } catch (error: unknown) {
      const normalized = normalizeError(error);
      console.error('Error initializing as streamer:', normalized);
      this.callbacks.onError?.(new Error(`Failed to initialize as streamer: ${normalized.message}`));
      throw normalized; // Re-throw for caller to handle
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
      let resendIntervalId: ReturnType<typeof setInterval> | null = null;
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
          if (resendIntervalId) {
            clearInterval(resendIntervalId);
            resendIntervalId = null;
          }
          
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
              if (resendIntervalId) {
                clearInterval(resendIntervalId);
                resendIntervalId = null;
              }
              reject(new Error(`ICE connection failed: ${state}`));
              clearTimeout(timeoutId);
            } else if (this.callbacks.onConnectionStateChange) {
              this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
            }
          }
        };
        
        // Send a connection request to the streamer
        const sendViewerConnect = () => {
          if (connectionTimedOut || connectionEstablished) {
            return;
          }
          this.signaling.sendMessage(
            streamerId,
            'viewer-connect',
            { viewerId: this.signaling.getUserId() }
          ).catch((err: unknown) => {
            console.error('Failed to send connection request:', normalizeError(err));
          });
          console.log('Sent connection request to streamer', streamerId);
        };

        sendViewerConnect();
        resendIntervalId = setInterval(sendViewerConnect, 5000);
        
        // Set up a timeout in case we don't get a response
        timeoutId = setTimeout(() => {
          connectionTimedOut = true;
          console.log('Connection attempt timed out');
          if (resendIntervalId) {
            clearInterval(resendIntervalId);
            resendIntervalId = null;
          }
          reject(new Error('Connection timed out waiting for streamer response'));
        }, this.connectionTimeout);
        
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        console.error('Error in initializeAsViewer:', normalized);
        this.callbacks.onError?.(new Error(`Failed to initialize as viewer: ${normalized.message}`));
        if (resendIntervalId) {
          clearInterval(resendIntervalId);
          resendIntervalId = null;
        }
        reject(normalized);
      }
    });
  }

  /**
   * Handle an incoming WebRTC offer
   */
  private async handleOffer(data: OfferPayload, sender: string): Promise<void> {
    console.log('📥 Received offer from', sender);
    console.log('Offer SDP type:', data.sdp.type, 'length:', data.sdp.sdp?.length);
    
    this.remoteUserId = sender;

    console.log('Setting remote description...');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    console.log('✅ Remote description set');
    
    await this.processIceCandidateQueue(); // Process any queued candidates

    console.log('Creating answer...');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    console.log('✅ Answer created and local description set');

    await this.signaling.sendMessage(this.remoteUserId, 'answer', {
      sdp: this.peerConnection.localDescription as RTCSessionDescriptionInit
    });
    console.log('📤 Sent SDP answer to streamer', this.remoteUserId);
  }

  /**
   * Handle an incoming WebRTC answer
   */
  private async handleAnswer(data: AnswerPayload): Promise<void> {
    console.log('📥 Received answer from viewer');
    console.log('Answer SDP type:', data.sdp.type, 'length:', data.sdp.sdp?.length);
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    console.log('✅ Remote description (answer) set successfully');
    
    await this.processIceCandidateQueue();
    console.log('✅ Processed queued ICE candidates');
  }

  /**
   * Handle an incoming ICE candidate
   */
  private async handleIceCandidate(data: IceCandidatePayload): Promise<void> {
    const candidate = new RTCIceCandidate(data.candidate);
    console.log('🧊 Received ICE candidate:', candidate.candidate?.substring(0, 50) + '...');
    
    if (this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
        console.log('✅ Added ICE candidate');
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
        const normalized = normalizeError(error);
        this.callbacks.onError?.(new Error(`Failed to add ICE candidate: ${normalized.message}`));
      }
    } else {
      this.iceCandidateQueue.push(candidate);
      console.log('📦 Queued ICE candidate (remote description not set yet), queue size:', this.iceCandidateQueue.length);
    }
  }

  /**
   * Handle disconnect request
   */
  private handleDisconnect(): void {
    console.log('Received disconnect signal from remote peer.');
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
    this.remoteUserId = null;
    this.localTracksAdded = false;
    this.localSenders = [];
    this.localStream = null;
    this.iceCandidateQueue = [];
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.setupPeerConnectionListeners();
  }

  /**
   * Expose RTCPeerConnection methods for direct use
   */
  public async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(description);
    await this.processIceCandidateQueue();
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return await this.peerConnection.createAnswer();
  }

  public async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setLocalDescription(description);
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    return await this.peerConnection.createOffer();
  }

  public addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    return this.peerConnection.addTrack(track, stream);
  }

  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    if (this.callbacks.onLocalStream) {
      this.callbacks.onLocalStream(stream);
    }

    if (this.localTracksAdded && this.localSenders.length) {
      const newTracks = stream.getTracks();
      for (let i = 0; i < newTracks.length; i++) {
        const sender = this.localSenders[i];
        const track = newTracks[i];
        if (sender && track) {
          sender.replaceTrack(track).catch((err) => {
            console.warn('Failed to replace track on existing sender:', err);
          });
        }
      }
    }
  }

  public getRemoteUserId(): string | null {
    return this.remoteUserId;
  }
}