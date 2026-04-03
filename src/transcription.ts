import fs from 'fs';
import os from 'os';
import path from 'path';

import OpenAI from 'openai';

import { logger } from './logger.js';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — voice transcription disabled');
    return null;
  }
  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Transcribe audio buffer using OpenAI Whisper.
 * Returns transcript text, or null on failure.
 */
export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  // Write to temp file — OpenAI SDK needs a file-like object
  const tmpPath = path.join(os.tmpdir(), filename);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const file = fs.createReadStream(tmpPath);

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      response_format: 'text',
    });

    const transcript =
      typeof response === 'string' ? response.trim() : (response as any).text?.trim() ?? '';

    logger.info(
      { filename, chars: transcript.length },
      'Transcribed voice message',
    );
    return transcript || null;
  } catch (err) {
    logger.error({ err, filename }, 'OpenAI transcription failed');
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}
