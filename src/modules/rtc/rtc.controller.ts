import { FastifyRequest, FastifyReply } from 'fastify';
import { RtcService } from './rtc.service.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/response.util.js';

export class RtcController {
  static async generateToken(
    request: FastifyRequest<{
      Querystring: {
        room_name?: string;
        participant_name?: string;
        roomName?: string;
        participantName?: string;
        identity?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const roomName = request.query.room_name || request.query.roomName;
    const participantName = request.query.participant_name || request.query.participantName;
    const identity = request.query.identity;

    if (!roomName || !participantName) {
      throw AppError.badRequest('Query parameters "room_name" and "participant_name" are required');
    }

    const apiKey = request.server.config.LIVEKIT_API_KEY;
    const apiSecret = request.server.config.LIVEKIT_API_SECRET;
    const livekitUrl = request.server.config.LIVEKIT_URL;

    if (!apiKey || !apiSecret) {
      throw AppError.internal('LiveKit credentials are not properly configured on the server');
    }

    const token = await RtcService.generateParticipantToken({
      apiKey,
      apiSecret,
      roomName,
      participantName,
      identity,
    });

    return sendSuccess(reply, {
      message: 'LiveKit RTC participant token generated',
      data: {
        token,
        room_name: roomName,
        participant_name: participantName,
        identity: identity || participantName,
        server_url: livekitUrl,
      },
    });
  }
}
