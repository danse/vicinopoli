import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { suggestGeocode } from "@/api/client";

export const DEBOUNCE_MS = 1200;
const MIN_QUERY_LENGTH = 3;

const suggestionCache = new Map<string, string[]>();

export function clearSuggestionCache() {
  suggestionCache.clear();
}

interface AddressComboboxProps {
  testId: string;
  address: string;
  onAddressChange: (address: string) => void;
}

export function AddressCombobox({
  testId,
  address,
  onAddressChange,
}: AddressComboboxProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  useEffect(() => {
    const query = address.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const cached = suggestionCache.get(query);
      if (cached) {
        setSuggestions(cached);
        setHighlighted(-1);
        setOpen(cached.length > 0);
        return;
      }
      suggestGeocode(query)
        .then((response) => {
          if (cancelled) return;
          suggestionCache.set(query, response.suggestions);
          setSuggestions(response.suggestions);
          setHighlighted(-1);
          setOpen(response.suggestions.length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setOpen(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address]);

  const select = (suggestion: string) => {
    onAddressChange(suggestion);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) =>
        Math.min(current + 1, suggestions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      select(suggestions[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={testId}
        data-testid={testId}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={address}
        role="combobox"
        aria-label={t("composer.addressLabel")}
        aria-expanded={open}
        aria-controls={`${testId}-suggestions`}
        aria-autocomplete="list"
        placeholder={t("composer.addressPlaceholder")}
        onChange={(e) => {
          onAddressChange(e.target.value);
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <ul
          id={`${testId}-suggestions`}
          role="listbox"
          aria-label={t("composer.addressSuggestionsLabel")}
          className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlighted}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                index === highlighted ? "bg-accent" : ""
              }`}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={() => select(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
