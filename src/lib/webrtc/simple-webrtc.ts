// Simple WebRTC implementation using proven patterns
export class SimpleStreamer {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.setupPeerConnection();
  }

  private setupPeerConnection() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Streamer: ICE candidate generated');
        this.storeIceCandidate(event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Streamer connection state:', this.pc.connectionState);
    };
  }

  async startStreaming(stream: MediaStream) {
    this.localStream = stream;
    
    // Add tracks to peer connection
    stream.getTracks().forEach(track => {
      this.pc.addTrack(track, stream);
    });

    // Create offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Store offer for viewers
    this.storeOffer(offer);
    console.log('Streamer: Offer created and stored');

    // Start listening for answers
    this.listenForAnswers();
  }

  private storeOffer(offer: RTCSessionDescriptionInit) {
    localStorage.setItem(`webrtc_offer_${this.deviceId}`, JSON.stringify(offer));
  }

  private storeIceCandidate(candidate: RTCIceCandidate) {
    const existing = JSON.parse(localStorage.getItem(`webrtc_ice_${this.deviceId}`) || '[]');
    existing.push(candidate);
    localStorage.setItem(`webrtc_ice_${this.deviceId}`, JSON.stringify(existing));
  }

  private listenForAnswers() {
    // Poll for answers from viewers
    const checkForAnswer = () => {
      const answerData = localStorage.getItem(`webrtc_answer_${this.deviceId}`);
      if (answerData && this.pc.signalingState === 'have-local-offer') {
        const answer = JSON.parse(answerData);
        this.pc.setRemoteDescription(answer).then(() => {
          console.log('Streamer: Answer received and applied');
          // Clear the answer so it's not processed again
          localStorage.removeItem(`webrtc_answer_${this.deviceId}`);
        }).catch(console.error);
      }
    };

    // Check every 1 second
    setInterval(checkForAnswer, 1000);
  }

  close() {
    this.pc.close();
    // Clean up stored data
    localStorage.removeItem(`webrtc_offer_${this.deviceId}`);
    localStorage.removeItem(`webrtc_ice_${this.deviceId}`);
  }
}

export class SimpleViewer {
  private pc: RTCPeerConnection;
  private onStreamCallback?: (stream: MediaStream) => void;

  constructor() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.setupPeerConnection();
  }

  private setupPeerConnection() {
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        console.log('Viewer: Received remote stream');
        this.onStreamCallback?.(event.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Viewer connection state:', this.pc.connectionState);
    };
  }

  async connectToStreamer(deviceId: string, onStream: (stream: MediaStream) => void) {
    this.onStreamCallback = onStream;

    // Get offer from storage
    const offer = this.getStoredOffer(deviceId);
    if (!offer) {
      throw new Error('No offer found for device');
    }

    console.log('Viewer: Found offer, creating answer');

    // Set remote description
    await this.pc.setRemoteDescription(offer);

    // Create answer
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // Send answer back to streamer
    this.sendAnswer(deviceId, answer);

    // Load and add stored ICE candidates
    await this.loadIceCandidates(deviceId);

    console.log('Viewer: Answer sent, waiting for connection');
  }

  private getStoredOffer(deviceId: string): RTCSessionDescriptionInit | null {
    const stored = localStorage.getItem(`webrtc_offer_${deviceId}`);
    return stored ? JSON.parse(stored) : null;
  }

  private sendAnswer(deviceId: string, answer: RTCSessionDescriptionInit) {
    localStorage.setItem(`webrtc_answer_${deviceId}`, JSON.stringify(answer));
  }

  private async loadIceCandidates(deviceId: string) {
    const stored = localStorage.getItem(`webrtc_ice_${deviceId}`);
    if (stored) {
      const candidates = JSON.parse(stored);
      for (const candidate of candidates) {
        try {
          await this.pc.addIceCandidate(candidate);
          console.log('Viewer: Added ICE candidate');
        } catch (error) {
          console.warn('Viewer: Failed to add ICE candidate:', error);
        }
      }
    }
  }

  close() {
    this.pc.close();
  }
}