import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("welcomes the student and links to sign up and sign in", () => {
    render(<Home />);
    expect(screen.getAllByText(/study reminder/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /create account|start planning/i })[0]).toHaveAttribute("href", "/signup");
    expect(screen.getAllByRole("link", { name: /sign in/i })[0]).toHaveAttribute("href", "/login");
  });
});
