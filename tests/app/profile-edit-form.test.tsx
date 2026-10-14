import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileEditForm } from "@/app/profile/ProfileEditForm";

vi.mock("@/lib/onboarding/updateProfile", () => ({ updateStudentProfile: vi.fn() }));
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";

const initial = {
  name: "Alex",
  dateOfBirth: "2010-01-01",
  grade: "9",
  schoolName: "Maple High",
  curriculum: "CBSE",
  academicYear: "2026-2027",
  timezone: "Asia/Kolkata",
};

describe("ProfileEditForm", () => {
  it("submits the edited fields and shows a saved confirmation", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: true });
    render(<ProfileEditForm userId="u1" initial={initial} guardianStatus={null} />);

    fireEvent.change(screen.getByDisplayValue("Maple High"), { target: { value: "New School" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
    expect(updateStudentProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ schoolName: "New School" }));
  });

  it("shows the server error message when the update fails", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: false, error: "Profile not found." });
    render(<ProfileEditForm userId="u1" initial={initial} guardianStatus={null} />);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/profile not found/i)).toBeInTheDocument());
  });
});
