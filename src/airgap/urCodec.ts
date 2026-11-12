/**
 * UR (Uniform Resource, BCR-2020-005) encoding / decoding helpers.
 *
 * Pure TypeScript (no React Native imports) so it can be unit tested in Node.
 */
import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';

/** Maximum accepted CBOR payload (bytes) for a decoded UR. */
export const MAX_UR_CBOR_BYTES = 512 * 1024;
/** Maximum accepted number of fragments in a multipart UR sequence. */
export const MAX_UR_SEQUENCE_LENGTH = 4000;
/** Maximum accepted length (chars) of a single scanned QR text. */
export const MAX_UR_PART_CHARS = 8000;

export const DEFAULT_MAX_FRAGMENT_LENGTH = 250;

export interface ScannedUR {
  type: string;
  cbor: Buffer;
}

export interface ReceiveResult {
  /** 0..1 estimated completion */
  progress: number;
  /** true when the full UR has been decoded */
  done: boolean;
  /** true if this exact part was already seen (ignored) */
  duplicate: boolean;
  /** error message if the part (or the whole sequence) is invalid */
  error?: string;
}

export function isURText(text: string | undefined | null): boolean {
  return !!text && text.trim().toLowerCase().startsWith('ur:');
}

/** Parse `ur:type/...` → { type, seqLength } (seqLength = 1 for single part). */
function peekPart(text: string): { type: string; seqLength: number } {
  const lower = text.toLowerCase();
  const components = lower.slice(3).split('/');
  const type = components[0];
  if (components.length === 2) {
    return { type, seqLength: 1 };
  }
  if (components.length === 3) {
    const seq = components[1].split('-');
    const seqLength = Number(seq[1]);
    if (seq.length !== 2 || !Number.isInteger(seqLength) || seqLength < 1) {
      throw new Error('Invalid UR sequence component');
    }
    return { type, seqLength };
  }
  throw new Error('Invalid UR format');
}

/**
 * Stateful multipart UR scanner. Feed every scanned QR text to `receivePart`.
 * Duplicate frames are ignored; a frame from a different UR (different type or
 * sequence length) restarts the decoding.
 */
export class URScanner {
  private decoder = new URDecoder();
  private seen = new Set<string>();
  private currentType?: string;
  private currentSeqLength?: number;
  private progress = 0;
  private result?: ScannedUR;

  reset(): void {
    this.decoder = new URDecoder();
    this.seen = new Set<string>();
    this.currentType = undefined;
    this.currentSeqLength = undefined;
    this.progress = 0;
    this.result = undefined;
  }

  isDone(): boolean {
    return this.result !== undefined;
  }

  getResult(): ScannedUR | undefined {
    return this.result;
  }

  getProgress(): number {
    return this.progress;
  }

  receivePart(rawText: string): ReceiveResult {
    const text = (rawText || '').trim().toLowerCase();
    if (this.result) {
      return { progress: 1, done: true, duplicate: true };
    }
    if (this.seen.has(text)) {
      return { progress: this.progress, done: false, duplicate: true };
    }
    if (!isURText(text)) {
      return { progress: this.progress, done: false, duplicate: false, error: 'Not a UR QR code' };
    }
    if (text.length > MAX_UR_PART_CHARS) {
      return { progress: this.progress, done: false, duplicate: false, error: 'QR code payload too large' };
    }

    let peek: { type: string; seqLength: number };
    try {
      peek = peekPart(text);
    } catch (e: any) {
      return { progress: this.progress, done: false, duplicate: false, error: e?.message || 'Invalid UR' };
    }
    if (peek.seqLength > MAX_UR_SEQUENCE_LENGTH) {
      return { progress: this.progress, done: false, duplicate: false, error: 'UR sequence too long' };
    }

    // A frame from a different UR: restart.
    if (
      this.currentType !== undefined &&
      (this.currentType !== peek.type || this.currentSeqLength !== peek.seqLength)
    ) {
      this.reset();
    }
    this.currentType = peek.type;
    this.currentSeqLength = peek.seqLength;
    this.seen.add(text);

    try {
      this.decoder.receivePart(text);
    } catch (e: any) {
      return { progress: this.progress, done: false, duplicate: false, error: e?.message || 'Invalid UR part' };
    }

    if (this.decoder.isError()) {
      const error = this.decoder.resultError() || 'UR decoding failed';
      this.reset();
      return { progress: 0, done: false, duplicate: false, error };
    }

    if (this.decoder.isSuccess()) {
      const ur = this.decoder.resultUR();
      if (ur.cbor.length > MAX_UR_CBOR_BYTES) {
        this.reset();
        return { progress: 0, done: false, duplicate: false, error: 'UR payload too large' };
      }
      this.result = { type: ur.type, cbor: Buffer.from(ur.cbor) };
      this.progress = 1;
      return { progress: 1, done: true, duplicate: false };
    }

    const estimated = this.decoder.estimatedPercentComplete();
    this.progress = Math.max(0, Math.min(0.99, Number(estimated) || 0));
    return { progress: this.progress, done: false, duplicate: false };
  }
}

/** Decode a complete set of UR parts (in any order). Throws if incomplete. */
export function decodeURParts(parts: string[]): ScannedUR {
  const scanner = new URScanner();
  for (const part of parts) {
    const res = scanner.receivePart(part);
    if (res.error) {
      throw new Error(res.error);
    }
    if (res.done) {
      break;
    }
  }
  const result = scanner.getResult();
  if (!result) {
    throw new Error('Incomplete UR');
  }
  return result;
}

export interface URFrameEncoder {
  /** true if the UR fits in a single QR frame */
  isSinglePart: boolean;
  /** number of pure fragments (fountain codes produce more frames after that) */
  fragmentCount: number;
  /** next frame text, UPPERCASE for QR alphanumeric mode */
  nextFrame(): string;
}

/** Create an (endless, fountain-coded) frame generator for an UR. */
export function createURFrameEncoder(
  ur: UR,
  maxFragmentLength: number = DEFAULT_MAX_FRAGMENT_LENGTH,
): URFrameEncoder {
  const encoder = new UREncoder(ur, maxFragmentLength);
  const isSinglePart = encoder.fragmentsLength <= 1;
  const single = isSinglePart ? UREncoder.encodeSinglePart(ur).toUpperCase() : undefined;
  return {
    isSinglePart,
    fragmentCount: encoder.fragmentsLength,
    nextFrame: () => (single !== undefined ? single : encoder.nextPart().toUpperCase()),
  };
}

/** Encode `count` consecutive frames (convenience for tests). */
export function encodeURFrames(
  ur: UR,
  count?: number,
  maxFragmentLength: number = DEFAULT_MAX_FRAGMENT_LENGTH,
): string[] {
  const enc = createURFrameEncoder(ur, maxFragmentLength);
  if (enc.isSinglePart) {
    return [enc.nextFrame()];
  }
  const n = count ?? enc.fragmentCount;
  const frames: string[] = [];
  for (let i = 0; i < n; i++) {
    frames.push(enc.nextFrame());
  }
  return frames;
}

export function makeUR(cbor: Buffer, type: string): UR {
  return new UR(cbor, type);
}
