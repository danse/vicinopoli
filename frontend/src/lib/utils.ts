import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAddress(address: string): string {
  return address.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function hashAddress(address: string): Promise<string> {
  try {
    const normalized = normalizeAddress(address);
    const data = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}
