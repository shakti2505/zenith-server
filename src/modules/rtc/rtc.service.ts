import { AccessToken } from 'livekit-server-sdk';

export interface GenerateTokenOptions {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  identity?: string;
  ttl?: string | number; // e.g. '10m', '1h', or seconds
}

export class RtcService {
  static async generateParticipantToken(options: GenerateTokenOptions): Promise<string> {
    const { apiKey, apiSecret, roomName, participantName, identity, ttl } = options;

    if (!apiKey || !apiSecret) {
      throw new Error('LiveKit API key and secret must be configured');
    }

    const participantIdentity = identity || participantName;

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: ttl || '1h',
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await token.toJwt();
  }
}
