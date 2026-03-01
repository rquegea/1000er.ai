import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KpiCard from "../KpiCard";

describe("KpiCard", () => {
  it("renders label and value correctly", () => {
    render(<KpiCard label="Total Facings" value={42} />);

    expect(screen.getByText("Total Facings")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("displays string values as-is", () => {
    render(<KpiCard label="OOS Rate" value="12.5%" />);

    expect(screen.getByText("OOS Rate")).toBeInTheDocument();
    expect(screen.getByText("12.5%")).toBeInTheDocument();
  });

  it("applies accent color when accent prop is true", () => {
    render(<KpiCard label="Alerts" value={3} accent />);

    const valueEl = screen.getByText("3");
    expect(valueEl).toHaveClass("text-[#ff3b30]");
  });

  it("uses default color when accent is false", () => {
    render(<KpiCard label="Products" value={10} />);

    const valueEl = screen.getByText("10");
    expect(valueEl).toHaveClass("text-[#1d1d1f]");
  });
});
