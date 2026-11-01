import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/app/(app)/AppShell";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

describe("AppShell navigation", () => {
  it("lists every core feature, including assessments, as a clear top-level nav link", () => {
    (usePathname as any).mockReturnValue("/dashboard");
    render(<AppShell studentName="Ada">content</AppShell>);

    const expected = ["Dashboard", "Study plan", "Tasks & homework", "Journal", "Progress", "Assessments", "Account"];
    for (const label of expected) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }
  });

  it("marks the current page as active via aria-current", () => {
    (usePathname as any).mockReturnValue("/tests");
    render(<AppShell studentName="Ada">content</AppShell>);

    const links = screen.getAllByRole("link", { name: "Assessments" });
    expect(links.some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });
});
