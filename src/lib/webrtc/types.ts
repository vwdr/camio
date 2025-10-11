export type SignalingMessageType =
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'viewer-connect'
  | 'disconnect'
  | 'stream-ended'
  | 'streamer-info'
  | 'streamer-info-request'
  | 'register-camera'
  | 'register-ack'
  | 'register-camera-error'
  | 'unknown';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface SignalingMessage<Payload = unknown> {
  type: SignalingMessageType | string;
  sender: string;
  recipient: string;
  data: Payload;
}

export interface StreamerInfoPayload {
  streamId: string;
  isStreaming: boolean;
  hasStream: boolean;
}

export interface StreamerInfoRequestPayload {
  viewerId: string;
  cameraId?: string;
}

export interface ViewerConnectPayload {
  viewerId: string;
}

export interface IceCandidatePayload {
  candidate: RTCIceCandidateInit;
}

export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface StreamEndedPayload {
  reason?: string;
}
