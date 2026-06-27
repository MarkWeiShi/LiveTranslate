import { create } from 'zustand';
import type { MeDto, UserCard } from '@linku/shared';
import { api } from '@/api/endpoints';
import { setAuthToken } from '@/api/client';
import { connectWs, disconnectWs } from '@/realtime/ws';

const TOKEN_KEY = 'linku.token';
const getStored = () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
const setStored = (t: string | null) => {
  if (typeof localStorage === 'undefined') return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

let heartbeat: ReturnType<typeof setInterval> | null = null;
function startHeartbeat() {
  stopHeartbeat();
  const beat = () => void api.heartbeat(true).catch(() => undefined);
  beat();
  heartbeat = setInterval(beat, 15_000);
}
function stopHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

interface AuthState {
  token: string | null;
  user: UserCard | null;
  me: MeDto | null;
  isNewUser: boolean;
  hydrated: boolean;
  login: (mockUserId: string) => Promise<void>;
  loginTelegram: (tgWebAppData: string) => Promise<void>;
  hydrate: () => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  me: null,
  isNewUser: false,
  hydrated: false,

  login: async (mockUserId) => {
    const res = await api.loginMock(mockUserId);
    setAuthToken(res.token);
    setStored(res.token);
    connectWs(res.token);
    startHeartbeat();
    set({ token: res.token, user: res.user, isNewUser: res.isNewUser });
    await get().refreshMe();
  },

  loginTelegram: async (tgWebAppData) => {
    const res = await api.loginTelegram(tgWebAppData);
    setAuthToken(res.token);
    setStored(res.token);
    connectWs(res.token);
    startHeartbeat();
    set({ token: res.token, user: res.user, isNewUser: res.isNewUser });
    await get().refreshMe();
  },

  hydrate: async () => {
    const token = getStored();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    setAuthToken(token);
    connectWs(token);
    startHeartbeat();
    set({ token });
    try {
      await get().refreshMe();
    } catch {
      // invalid token
      get().logout();
    } finally {
      set({ hydrated: true });
    }
  },

  refreshMe: async () => {
    const me = await api.me();
    set({ me, user: me });
  },

  logout: () => {
    stopHeartbeat();
    disconnectWs();
    setAuthToken(null);
    setStored(null);
    set({ token: null, user: null, me: null, isNewUser: false });
  },
}));
