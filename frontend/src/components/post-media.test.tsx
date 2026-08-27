import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "../i18n";
import { PostMedia } from "./post-media";

const voice = {
  id: "media-1",
  kind: "voice" as const,
  url: "https://storage.example.test/a.webm",
  duration_s: 3.5,
};

describe("PostMedia", () => {
  it("renders nothing without media", () => {
    const { container } = render(<PostMedia media={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a voice player that only preloads metadata", () => {
    render(<PostMedia media={[voice]} />);
    const audio = screen.getByLabelText("Messaggio vocale allegato");
    expect(audio).toHaveAttribute("preload", "metadata");
    expect(audio).toHaveAttribute("controls");
  });
});