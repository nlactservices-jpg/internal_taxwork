import { describe, expect, it } from "vitest";
import { maskEmail, reportExportFileName } from "@/lib/report-format";

describe("maskEmail", () => {
  it("masks the local part and keeps the domain recognisable", () => {
    expect(maskEmail("somchai@example.com")).toBe("so*****@example.com");
  });

  it("always shows at least three mask characters", () => {
    expect(maskEmail("ab@example.com")).toBe("ab***@example.com");
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskEmail("  user@example.com  ")).toBe("us***@example.com");
  });

  it("returns values that are not usable email addresses unchanged", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
    expect(maskEmail("@example.com")).toBe("@example.com");
    expect(maskEmail("user@")).toBe("user@");
  });
});

describe("reportExportFileName", () => {
  const base = {
    periodLabel: "2026-10",
    clientName: "บริษัท ไดฟ์ เทอร์มินอล จำกัด",
    avatarText: "DTN",
  };

  it("puts the client code first and uses the Buddhist year", () => {
    expect(reportExportFileName({ ...base, reportLabel: "ครั้งที่ 1" }))
      .toBe("DTN_2569-10_รายงานภาษี_ครั้งที่ 1.pdf");
  });

  it("falls back to seq when there is no custom label", () => {
    expect(reportExportFileName({ ...base, seq: 2 }))
      .toBe("DTN_2569-10_รายงานภาษี_ครั้งที่ 2.pdf");
  });

  it("supports the Gregorian year", () => {
    expect(reportExportFileName({ ...base, buddhistYear: false }))
      .toBe("DTN_2026-10_รายงานภาษี.pdf");
  });

  it("falls back to initials then name when no code is set", () => {
    expect(reportExportFileName({ periodLabel: "2026-08", clientName: "Drive Terminal Co., Ltd." }))
      .toBe("DT_2569-08_รายงานภาษี.pdf");
    expect(reportExportFileName({ periodLabel: "2026-08", clientName: "บริษัท abc จำกัด" }))
      .toBe("A_2569-08_รายงานภาษี.pdf");
  });

  it("sanitizes unsafe characters", () => {
    expect(reportExportFileName({ ...base, reportLabel: "a/b:c" }))
      .toBe("DTN_2569-10_รายงานภาษี_a-b-c.pdf");
  });
});
