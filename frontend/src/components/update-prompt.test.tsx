import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UpdatePrompt } from "./update-prompt";
import "../i18n";

const mockState = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [mockState.needRefresh, mockState.setNeedRefresh],
    offlineReady: [mockState.offlineReady, mockState.setOfflineReady],
    updateServiceWorker: mockState.updateServiceWorker,
  }),
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    mockState.needRefresh = false;
    mockState.offlineReady = false;
    mockState.setNeedRefresh.mockClear();
    mockState.setOfflineReady.mockClear();
    mockState.updateServiceWorker.mockClear();
  });

  it("renders nothing when no update is waiting", () => {
    render(<UpdatePrompt />);
    expect(screen.queryByTestId("update-prompt")).not.toBeInTheDocument();
  });

  it("asks to reload when a new version is waiting", () => {
    mockState.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("update-prompt-reload")).toBeInTheDocument();
  });

  it("reloads to apply the update when confirmed", () => {
    mockState.needRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByTestId("update-prompt-reload"));
    expect(mockState.updateServiceWorker).toHaveBeenCalledTimes(1);
  });

  it("can be dismissed without reloading", () => {
    mockState.needRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByTestId("update-prompt-close"));
    expect(mockState.updateServiceWorker).not.toHaveBeenCalled();
    expect(mockState.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("shows an offline-ready notice on first install", () => {
    mockState.offlineReady = true;
    render(<UpdatePrompt />);
    expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
    expect(
      screen.queryByTestId("update-prompt-reload"),
    ).not.toBeInTheDocument();
  });
});