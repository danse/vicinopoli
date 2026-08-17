import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMe } from "@/api/client";

const ADDRESS_STORAGE_KEY = "vicinopoli.address";

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

interface AppContextValue {
  address: string;
  setAddress: (address: string) => void;
  pseudonym: string;
  setPseudonym: (pseudonym: string) => void;
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
  const [consentDecided, setConsentDecided] = useState(true);
  const [analyticsConsented, setAnalyticsConsented] = useState(false);
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

  const decideConsent = (consented: boolean) => {
    setConsentDecided(true);
    setAnalyticsConsented(consented);
  };

  const handleSetAddress = (next: string) => {
    setAddress(next);
    writeStoredAddress(next);
  };

  const bumpFeedTick = () => setFeedTick((tick) => tick + 1);

  return (
    <AppContext.Provider
      value={{
        address,
        setAddress: handleSetAddress,
        pseudonym,
        setPseudonym,
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
