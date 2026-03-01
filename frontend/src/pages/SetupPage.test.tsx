import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SetupPage } from "./SetupPage";
import { useSessionStore } from "../stores/session";

vi.mock("../lib/api", () => ({
  fetchSystemModels: vi.fn().mockResolvedValue([]),
  fetchByokModels: vi.fn().mockResolvedValue([]),
  startRoundtable: vi.fn()
}));

describe("SetupPage", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  test("shows BYOK input when mode switched to bring your key", () => {
    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /^byok$/i }));
    expect(screen.getByPlaceholderText("sk-or-...")).toBeInTheDocument();
  });
});
