import { create } from 'zustand';
import type {
  CallMode,
  CaptionPayload,
  EndCallResponse,
  IncomingCallPayload,
  RiskWarningPayload,
  TranslationState,
  UserCard,
} from '@linku/shared';

export interface ActiveCall {
  callId: string;
  room: string;
  peer: UserCard | null;
  mode: CallMode;
  isCaller: boolean;
}

interface CallState {
  incoming: IncomingCallPayload | null;
  active: ActiveCall | null;
  translationState: TranslationState;
  translationOn: boolean;
  captions: CaptionPayload[];
  trialSecondsLeft: number;
  paywallVisible: boolean;
  risk: RiskWarningPayload | null;
  giftFlash: string | null;
  lastEnded: (EndCallResponse & { callId: string }) | null;

  setIncoming: (p: IncomingCallPayload | null) => void;
  startActive: (c: ActiveCall) => void;
  pushCaption: (c: CaptionPayload) => void;
  setTranslationState: (s: TranslationState, secLeft?: number) => void;
  setTranslationOn: (on: boolean) => void;
  showPaywall: (v: boolean) => void;
  setRisk: (r: RiskWarningPayload | null) => void;
  flashGift: (giftType: string | null) => void;
  endActive: (r: EndCallResponse & { callId: string }) => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  incoming: null,
  active: null,
  translationState: 'active',
  translationOn: true,
  captions: [],
  trialSecondsLeft: -1,
  paywallVisible: false,
  risk: null,
  giftFlash: null,
  lastEnded: null,

  setIncoming: (p) => set({ incoming: p }),
  startActive: (c) =>
    set({
      active: c,
      incoming: null,
      captions: [],
      translationState: 'active',
      translationOn: true,
      paywallVisible: false,
      risk: null,
      giftFlash: null,
    }),
  pushCaption: (c) => set({ captions: [...get().captions.slice(-40), c] }),
  setTranslationState: (s, secLeft) =>
    set((st) => ({
      translationState: s,
      trialSecondsLeft: secLeft ?? st.trialSecondsLeft,
    })),
  setTranslationOn: (on) => set({ translationOn: on }),
  showPaywall: (v) => set({ paywallVisible: v }),
  setRisk: (r) => set({ risk: r }),
  flashGift: (giftType) => set({ giftFlash: giftType }),
  endActive: (r) => set({ active: null, incoming: null, lastEnded: r }),
  reset: () =>
    set({
      incoming: null,
      active: null,
      captions: [],
      translationState: 'active',
      paywallVisible: false,
      risk: null,
      giftFlash: null,
    }),
}));
