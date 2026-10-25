"use client";

import { useState } from "react";
import { updatePreferences, type PreferencesView } from "@/lib/notifications/preferences";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";
const TIME_INPUT_CLASS = `${INPUT_CLASS} [color-scheme:dark]`;

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
    <form onSubmit={handleSubmit} className="panel-cosmic flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-ink">Notification preferences</h2>

      <fieldset className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">Reminder channel</span>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-cosmic-deep/40 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="none"
              checked={channel === "none"}
              onChange={() => setChannel("none")}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-ink">None</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="email"
              checked={channel === "email"}
              onChange={() => setChannel("email")}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-sm text-ink">Email</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="channel"
              value="whatsapp"
              checked={channel === "whatsapp"}
              onChange={() => setChannel("whatsapp")}
              className="h-4 w-4 accent-brand"
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
          className={TIME_INPUT_CLASS}
        />
      </label>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-ink">Quiet hours start</span>
          <input
            type="time"
            value={quietHoursStart}
            onChange={(e) => setQuietHoursStart(e.target.value)}
            className={TIME_INPUT_CLASS}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-ink">Quiet hours end</span>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(e) => setQuietHoursEnd(e.target.value)}
            className={TIME_INPUT_CLASS}
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
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-cosmic-deep/40 p-3">
            <input
              type="checkbox"
              checked={whatsappConsentGiven}
              onChange={(e) => setWhatsappConsentGiven(e.target.checked)}
              className="mt-1 h-4 w-4 accent-brand"
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
      {status === "saved" && <p className="text-sm text-success">Saved.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
