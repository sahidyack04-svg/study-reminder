import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingWizard } from "@/app/onboarding/OnboardingWizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/onboarding/completeOnboarding", () => ({ completeOnboarding: vi.fn() }));

describe("OnboardingWizard", () => {
  it("keeps Next disabled until the basics step is filled in", () => {
    render(<OnboardingWizard userId="u1" />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText(/grade/i), { target: { value: "9" } });
    fireEvent.change(screen.getByPlaceholderText(/school name/i), { target: { value: "Maple High" } });
    fireEvent.change(screen.getByPlaceholderText(/curriculum/i), { target: { value: "CBSE" } });
    fireEvent.change(screen.getByPlaceholderText(/academic year/i), { target: { value: "2026-2027" } });

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(); // DOB still missing
  });

  it("requires guardian fields once a date of birth implies the student is a minor", () => {
    render(<OnboardingWizard userId="u1" />);
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: "2015-01-01" } });

    expect(screen.getByPlaceholderText(/guardian name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
