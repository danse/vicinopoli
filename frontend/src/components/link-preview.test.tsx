import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import { LinkPreview } from "./link-preview";

const api = vi.hoisted(() => ({
  getLinkPreview: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  getLinkPreview: api.getLinkPreview,
}));

const previewData = {
  url: "https://example.com/article",
  title: "Example title",
  description: "Example description",
  image_url: "https://example.com/img.jpg",
  provider_name: "Example Site",
  provider_url: null,
  type: "article",
};

describe("LinkPreview", () => {
  beforeEach(() => {
    api.getLinkPreview.mockReset();
  });

  it("shows a loading state, then the card when the preview arrives", async () => {
    api.getLinkPreview.mockResolvedValue(previewData);
    render(<LinkPreview url={previewData.url} />);

    expect(screen.getByText("Caricamento anteprima…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Example title")).toBeInTheDocument();
    });
    expect(screen.getByText("Example description")).toBeInTheDocument();
    expect(screen.getByText("Example Site")).toBeInTheDocument();
    const card = await screen.findByTestId("link-preview");
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/img.jpg",
    );
  });

  it("renders the link opening in a new tab", async () => {
    api.getLinkPreview.mockResolvedValue(previewData);
    render(<LinkPreview url={previewData.url} />);

    const link = await screen.findByTestId("link-preview");
    expect(link).toHaveAttribute("href", previewData.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the URL for missing metadata", async () => {
    api.getLinkPreview.mockResolvedValue({
      url: previewData.url,
      title: null,
      description: null,
      image_url: null,
      provider_name: null,
      provider_url: null,
      type: null,
    });
    render(<LinkPreview url={previewData.url} />);

    await waitFor(() => {
      expect(screen.getAllByText(previewData.url).length).toBeGreaterThan(0);
    });
  });

  it("hides the card entirely when the preview fails", async () => {
    api.getLinkPreview.mockRejectedValue(new Error("boom"));
    render(<LinkPreview url={previewData.url} />);

    await waitFor(() => {
      expect(screen.queryByTestId("link-preview")).not.toBeInTheDocument();
    });
  });
});