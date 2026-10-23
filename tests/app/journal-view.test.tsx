import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalView } from "@/app/journal/JournalView";
import { formatUTCDate } from "@/lib/validation/age";

vi.mock("@/lib/journal/journal", () => ({ saveJournalEntry: vi.fn() }));
import { saveJournalEntry } from "@/lib/journal/journal";

const pastEntries = [
  { id: "j0", date: new Date("2026-10-16"), content: "Yesterday's entry" },
];

describe("JournalView", () => {
  it("saves today's entry and shows a confirmation", async () => {
    (saveJournalEntry as any).mockResolvedValue({ success: true });
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);

    fireEvent.change(screen.getByPlaceholderText(/how was today/i), { target: { value: "Studied algebra." } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(saveJournalEntry).toHaveBeenCalledWith("Studied algebra.");
    });
  });

  it("shows an error when saving fails", async () => {
    (saveJournalEntry as any).mockResolvedValue({ success: false, error: "Journal entry cannot be empty." });
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/journal entry cannot be empty/i)).toBeInTheDocument();
    });
  });

  it("lists past entries in reverse chronological order, read-only", () => {
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);
    expect(screen.getByText("Yesterday's entry")).toBeInTheDocument();
  });

  it("pre-fills the textarea when today's entry already exists", () => {
    render(<JournalView todayEntry={{ id: "j1", date: new Date(), content: "Already written today" }} pastEntries={[]} />);
    expect(screen.getByDisplayValue("Already written today")).toBeInTheDocument();
  });

  it("renders a past entry's date in UTC, not the host's local timezone", () => {
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);
    expect(screen.getByText(formatUTCDate(pastEntries[0].date))).toBeInTheDocument();
  });
});
