import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import "../i18n";

import { SupportPage } from "./support-page";

const SUPPORT_EMAIL = "info@vicinopoli.it";

describe("SupportPage", () => {
  it("shows the configured support email as a mailto link", () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );
    const link = screen.getByTestId("support-email");
    expect(link).toHaveTextContent(SUPPORT_EMAIL);
    expect(link).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
  });

  it("offers a way back to the address page", () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("support-back")).toHaveAttribute("href", "/address");
  });
});