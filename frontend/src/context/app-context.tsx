import {
  createContext,
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
  const [feedTick, setFeedTick] = useState(0);

  useEffect(() => {
    getMe()
      .then((me) => {
        setPseudonym(me.pseudonym ?? "");
        setExperimentFlags(me.experiment_flags);
        if (me.analytics_consent === null) {
          setConsentDecided(false);
        } else {
          setAnalyticsConsented(me.analytics_consent === true);
        }
      })
      .catch(() => {});
  }, []);

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
