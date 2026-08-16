import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMe } from "@/api/client";

interface AppContextValue {
  address: string;
  setAddress: (address: string) => void;
  pseudonym: string;
  setPseudonym: (pseudonym: string) => void;
  consentDecided: boolean;
  analyticsConsented: boolean;
  decideConsent: (consented: boolean) => void;
  feedTick: number;
  bumpFeedTick: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState("");
  const [pseudonym, setPseudonym] = useState("");
  const [consentDecided, setConsentDecided] = useState(true);
  const [analyticsConsented, setAnalyticsConsented] = useState(false);
  const [feedTick, setFeedTick] = useState(0);

  useEffect(() => {
    getMe()
      .then((me) => {
        setPseudonym(me.pseudonym ?? "");
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

  const bumpFeedTick = () => setFeedTick((tick) => tick + 1);

  return (
    <AppContext.Provider
      value={{
        address,
        setAddress,
        pseudonym,
        setPseudonym,
        consentDecided,
        analyticsConsented,
        decideConsent,
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
