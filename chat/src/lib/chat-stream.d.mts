export type ChatStage = 'checking' | 'working' | 'saving';
export class ChatStreamError extends Error { code: string; }
export function readChatStream(body: ReadableStream<Uint8Array> | null, onStatus?: (stage: ChatStage) => void): Promise<Record<string, unknown>>;
