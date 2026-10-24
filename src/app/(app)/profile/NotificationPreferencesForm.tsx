"use client";

import { useState } from "react";
import { updatePreferences, type PreferencesView } from "@/lib/notifications/preferences";

export interface NotificationPreferencesFormProps {
  initial: PreferencesView;
}

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
  const [channel, setChannel] = useState(initial.channel);
  const [time, setTime] = useState(initial.preferredTimes[0] ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [quietHoursStart, setQuietHoursStart] = useState(initial.quietHoursStart ?? "");
  const [quietHoursEnd, setQuietHoursEnd] = useState(initial.quietHoursEnd ?? "");
  const [whatsappConsentGiven, setWhatsappConsentGiven] = useState(initial.whatsappConsentGiven);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const result = await updatePreferences({
      channel,
      preferredTimes: time ? [time] : [],
      phone: channel === "whatsapp" ? phone : null,
      quietHoursStart: quietHoursStart || null,
      quietHoursEnd: quietHoursEnd || null,
      whatsappConsentGiven: channel === "whatsapp" ? whatsappConsentGiven : false,
    });
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Notification preferences</h2>

      <fieldset className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Reminder channel</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="none"
              checked={channel === "none"}
              onChange={() => setChannel("none")}
            />
            <span className="text-sm text-ink">None</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="email"
              checked={channel === "email"}
              onChange={() => setChannel("email")}
            />
            <span className="text-sm text-ink">Email</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="whatsapp"
              checked={channel === "whatsapp"}
              onChange={() => setChannel("whatsapp")}
            />
            <span className="text-sm text-ink">WhatsApp</span>
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Preferred reminder time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Quiet hours start</span>
          <input
            type="time"
            value={quietHoursStart}
            onChange={(e) => setQuietHoursStart(e.target.value)}
            className="rounded-lg border border-border px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Quiet hours end</span>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(e) => setQuietHoursEnd(e.target.value)}
            className="rounded-lg border border-border px-4 py-2"
          />
        </label>
      </div>

      {channel === "whatsapp" && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="rounded-lg border border-border px-4 py-2"
            />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={whatsappConsentGiven}
              onChange={(e) => setWhatsappConsentGiven(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-ink-muted">
              By enabling WhatsApp reminders, you agree to receive daily study reminder messages at
              this number. WhatsApp delivery is not yet configured — your preference will be saved and
              used once it is.
            </span>
          </label>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
