import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationPreferencesForm } from "@/app/(app)/profile/NotificationPreferencesForm";

vi.mock("@/lib/notifications/preferences", () => ({ updatePreferences: vi.fn() }));
import { updatePreferences } from "@/lib/notifications/preferences";

const initial = {
  channel: "none" as const, preferredTimes: [], phone: null,
  quietHoursStart: null, quietHoursEnd: null, whatsappConsentGiven: false,
};

describe("NotificationPreferencesForm", () => {
  it("only shows the phone field and consent checkbox when whatsapp is selected", () => {
    render(<NotificationPreferencesForm initial={initial} />);
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/whatsapp/i));
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByText(/By enabling WhatsApp reminders/i)).toBeInTheDocument();
  });

  it("shows a validation error and does not save when whatsapp is chosen without checking consent", async () => {
    (updatePreferences as any).mockResolvedValue({ success: false, error: "WhatsApp requires your consent." });
    render(<NotificationPreferencesForm initial={initial} />);
    fireEvent.click(screen.getByLabelText(/whatsapp/i));
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+15551234567" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/requires your consent/i)).toBeInTheDocument();
    });
  });

  it("saves successfully and shows a confirmation", async () => {
    (updatePreferences as any).mockResolvedValue({ success: true });
    render(<NotificationPreferencesForm initial={initial} />);
    fireEvent.click(screen.getByLabelText(/email/i));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });
});
