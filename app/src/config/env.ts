export const ENV = {
  apiBase: process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000',
  wsBase: process.env.EXPO_PUBLIC_WS_BASE ?? 'http://localhost:3000',
  transport: (process.env.EXPO_PUBLIC_TRANSPORT ?? 'mock') as 'mock' | 'livekit',
  auth: (process.env.EXPO_PUBLIC_AUTH ?? 'mock') as 'mock' | 'hellotalk',
  mockMedia: (process.env.EXPO_PUBLIC_MOCK_MEDIA ?? 'webrtc') as 'webrtc' | 'loopback',
  mockTts: process.env.EXPO_PUBLIC_MOCK_TTS === 'on',
};
