import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMe, sendAnalyticsEvents, type PostVoice } from "@/api/client";
import { initGtag, setConsent } from "@/lib/analytics";

export type ComposerMessageType = "text" | "photo" | "voice";

export interface ComposerDraft {
  type: ComposerMessageType;
  body: string;
  scope: PostVoice;
  photo: File | null;
  voice: { blob: Blob; duration_s: number } | null;
}

export const EMPTY_DRAFT: ComposerDraft = {
  type: "text",
  body: "",
  scope: "city",
  photo: null,
  voice: null,
};

const ADDRESS_STORAGE_KEY = "vicinopoli.address";
const ADDRESS_SET_STORAGE_KEY = "vicinopoli.address-set";

function readStoredAddress(): string {
  try {
    return window.localStorage.getItem(ADDRESS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredAddress(address: string) {
  try {
    window.localStorage.setItem(ADDRESS_STORAGE_KEY, address);
  } catch {
    // Privacy mode or storage full: the address just won't survive a refresh.
  }
}

function readAddressSetFlag(): string {
  try {
    return window.localStorage.getItem(ADDRESS_SET_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeAddressSetFlag(value: string) {
  try {
    window.localStorage.setItem(ADDRESS_SET_STORAGE_KEY, value);
  } catch {
    // Same privacy-mode caveat as the address itself.
  }
}

interface AppContextValue {
  address: string;
  setAddress: (address: string) => void;
  pseudonym: string;
  setPseudonym: (pseudonym: string) => void;
  draft: ComposerDraft;
  setDraft: (draft: ComposerDraft | ((prev: ComposerDraft) => ComposerDraft)) => void;
  consentDecided: boolean;
  analyticsConsented: boolean;
  decideConsent: (consented: boolean) => void;
  experimentFlags: Record<string, boolean>;
  dailyPostLimit: number | null;
  postsLeftToday: number | null;
  refreshDevice: () => void;
  feedTick: number;
  bumpFeedTick: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState(readStoredAddress);
  const [pseudonym, setPseudonym] = useState("");
  // In-memory composer draft: survives route changes (e.g. the pseudonym
  // detour) but never touches storage — a message is user content.
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_DRAFT);
  const [consentDecided, setConsentDecided] = useState(true);
  const [analyticsConsented, setAnalyticsConsented] = useState(false);
  const [addressSetPending, setAddressSetPending] = useState(
    () => readAddressSetFlag() === "pending",
  );
  const [experimentFlags, setExperimentFlags] = useState<Record<string, boolean>>(
    {},
  );
  const [dailyPostLimit, setDailyPostLimit] = useState<number | null>(null);
  const [postsLeftToday, setPostsLeftToday] = useState<number | null>(null);
  const [feedTick, setFeedTick] = useState(0);

  const applyDevice = (me: {
    pseudonym?: string | null;
    experiment_flags: Record<string, boolean>;
    analytics_consent?: boolean | null;
    daily_post_limit?: number | null;
    posts_left_today?: number | null;
  }) => {
    setPseudonym(me.pseudonym ?? "");
    setExperimentFlags(me.experiment_flags);
    setDailyPostLimit(me.daily_post_limit ?? null);
    setPostsLeftToday(me.posts_left_today ?? null);
    if (me.analytics_consent === null) {
      setConsentDecided(false);
    } else {
      setAnalyticsConsented(me.analytics_consent === true);
    }
  };

  const refreshDevice = useCallback(() => {
    getMe()
      .then((me) => applyDevice(me))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshDevice();
  }, [refreshDevice]);

  // Google Ads tag (ADR 0026): load once with every consent signal denied,
  // then reflect the GDPR choice as soon as it is known.
  useEffect(() => {
    initGtag();
  }, []);

  useEffect(() => {
    if (!consentDecided) return;
    setConsent(analyticsConsented);
  }, [consentDecided, analyticsConsented]);

  // First-address-set milestone: once per device, as soon as consent is known.
  // The flag lives in localStorage so an address set before the banner is
  // decided still counts when the user later accepts.
  useEffect(() => {
    if (!analyticsConsented || !addressSetPending) return;
    writeAddressSetFlag("reported");
    setAddressSetPending(false);
    void sendAnalyticsEvents([{ name: "address_set" }]).catch(() => {});
  }, [analyticsConsented, addressSetPending]);

  const decideConsent = (consented: boolean) => {
    setConsentDecided(true);
    setAnalyticsConsented(consented);
  };

  const handleSetAddress = (next: string) => {
    const wasEmpty = address.trim() === "";
    setAddress(next);
    writeStoredAddress(next);
    if (wasEmpty && next.trim() !== "" && readAddressSetFlag() === "") {
      writeAddressSetFlag("pending");
      setAddressSetPending(true);
    }
  };

  const bumpFeedTick = () => setFeedTick((tick) => tick + 1);

  return (
    <AppContext.Provider
      value={{
        address,
        setAddress: handleSetAddress,
        pseudonym,
        setPseudonym,
        draft,
        setDraft,
        consentDecided,
        analyticsConsented,
        decideConsent,
        experimentFlags,
        dailyPostLimit,
        postsLeftToday,
        refreshDevice,
        feedTick,
        bumpFeedTick,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
