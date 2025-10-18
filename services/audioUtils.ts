// --- Decoding ---

function decodeBase64(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Failed to decode base64 string:", e);
    throw new Error("Base64 decoding failed. The string might be corrupted or incorrectly encoded.");
  }
}

/**
 * Decodes a base64 data URL (e.g., from a file upload) into an AudioBuffer.
 */
export async function decodeDataUrlAudio(dataUrl: string, ctx: AudioContext): Promise<AudioBuffer> {
    try {
        const base64String = dataUrl.split(',')[1];
        const arrayBuffer = decodeBase64(base64String).buffer;
        return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error(`Error decoding audio from data URL:`, e);
        return ctx.createBuffer(1, 1, ctx.sampleRate);
    }
}


/**
 * Decodes raw PCM audio data from a base64 string, as returned by the Gemini TTS API.
 */
export async function decodePcmAudioData(
  base64: string,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const data = decodeBase64(base64);

  if (data.buffer.byteLength % 2 !== 0) {
    console.error("Audio data has an odd byte length, which is invalid for Int16Array. Skipping this buffer.");
    return ctx.createBuffer(numChannels, 1, sampleRate);
  }
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Fetches an audio file (like WAV or MP3) from a URL and decodes it into an AudioBuffer.
 */
export async function fetchAndDecodeAudio(url: string, ctx: AudioContext): Promise<AudioBuffer> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio from ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.error(`Error fetching or decoding audio from ${url}:`, e);
        return ctx.createBuffer(1, 1, ctx.sampleRate);
    }
}


// --- Audio Manipulation ---

export function loopAndExtendAudio(
    sourceBuffer: AudioBuffer,
    targetDurationSeconds: number,
    audioContext: AudioContext
): AudioBuffer {
    const targetFrameCount = Math.floor(targetDurationSeconds * audioContext.sampleRate);
    const sourceFrameCount = sourceBuffer.length;
    
    if (targetFrameCount <= sourceFrameCount) {
        const newBuffer = audioContext.createBuffer(sourceBuffer.numberOfChannels, targetFrameCount, audioContext.sampleRate);
        for(let i = 0; i < sourceBuffer.numberOfChannels; i++) {
            newBuffer.copyToChannel(sourceBuffer.getChannelData(i).slice(0, targetFrameCount), i);
        }
        return newBuffer;
    }

    const newBuffer = audioContext.createBuffer(sourceBuffer.numberOfChannels, targetFrameCount, audioContext.sampleRate);

    for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
        const sourceData = sourceBuffer.getChannelData(channel);
        const targetData = newBuffer.getChannelData(channel);
        
        let offset = 0;
        while (offset < targetFrameCount) {
            const remainingFrames = targetFrameCount - offset;
            const framesToCopy = Math.min(remainingFrames, sourceFrameCount);
            targetData.set(sourceData.subarray(0, framesToCopy), offset);
            offset += framesToCopy;
        }
    }

    return newBuffer;
}


export function mixAudioBuffers(
    foreground: AudioBuffer,
    background: AudioBuffer,
    backgroundVolume: number,
    audioContext: AudioContext
): AudioBuffer {
    const foregroundLength = foreground.length;
    const mixedBuffer = audioContext.createBuffer(
        Math.max(foreground.numberOfChannels, background.numberOfChannels),
        foregroundLength,
        foreground.sampleRate
    );

    const loopedBackground = loopAndExtendAudio(background, foreground.duration, audioContext);

    for (let channel = 0; channel < mixedBuffer.numberOfChannels; channel++) {
        const foregroundData = foreground.numberOfChannels > channel ? foreground.getChannelData(channel) : new Float32Array(foregroundLength);
        const backgroundData = loopedBackground.numberOfChannels > channel ? loopedBackground.getChannelData(channel) : new Float32Array(foregroundLength);
        const mixedData = mixedBuffer.getChannelData(channel);

        for (let i = 0; i < foregroundLength; i++) {
            const backgroundSample = (backgroundData[i] || 0) * backgroundVolume;
            const foregroundSample = foregroundData[i] || 0;
            
            let mixedSample = foregroundSample + backgroundSample;

            // Simple clipping to avoid distortion
            if (mixedSample > 1.0) {
                mixedSample = 1.0;
            } else if (mixedSample < -1.0) {
                mixedSample = -1.0;
            }
            mixedData[i] = mixedSample;
        }
    }

    return mixedBuffer;
}


// --- Concatenation ---

export function concatenateAudioBuffers(buffers: AudioBuffer[], audioContext: AudioContext): AudioBuffer {
  let totalLength = 0;
  for (const buffer of buffers) {
    totalLength += buffer.length;
  }

  const result = audioContext.createBuffer(1, totalLength, audioContext.sampleRate);
  const channelData = result.getChannelData(0);

  let offset = 0;
  for (const buffer of buffers) {
    channelData.set(buffer.getChannelData(0), offset);
    offset += buffer.length;
  }

  return result;
}


// --- WAV Encoding ---

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let pos = 0;

  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, 36 + buffer.length * numOfChan * 2, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, 1, true); pos += 2;
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, buffer.sampleRate, true); pos += 4;
  view.setUint32(pos, buffer.sampleRate * 2 * numOfChan, true); pos += 4;
  view.setUint16(pos, numOfChan * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, buffer.length * numOfChan * 2, true); pos += 4;

  const channels = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: 'audio/wav' });
}