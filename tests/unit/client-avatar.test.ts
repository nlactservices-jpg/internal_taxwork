import { describe, expect, it } from "vitest";
import {
  clientInitials,
  contrastText,
  isValidClientCode,
  normalizeClientCode,
  normalizeHex,
  normalizeInitials,
  resolveInitials,
  suggestClientCode,
} from "@/lib/client-avatar";

describe("normalizeInitials", () => {
  it("uppercases English letters and strips everything else", () => {
    expect(normalizeInitials(" dtn ")).toBe("DTN");
    expect(normalizeInitials("a-b.c")).toBe("ABC");
    expect(normalizeInitials("ภาษี")).toBe("");
  });

  it("keeps at most 4 characters", () => {
    expect(normalizeInitials("ABCDE")).toBe("ABCD");
  });

  it("returns empty for blank input", () => {
    expect(normalizeInitials(null)).toBe("");
    expect(normalizeInitials("  ")).toBe("");
  });
});

describe("clientInitials", () => {
  it("returns nothing for a purely Thai name", () => {
    expect(clientInitials("บริษัท ไดฟ์ เทอร์มินอล จำกัด")).toBe("");
  });

  it("derives Latin initials and drops suffix words", () => {
    expect(clientInitials("Drive Terminal Co., Ltd.")).toBe("DT");
    expect(clientInitials("Acme Holdings Inc")).toBe("A");
  });

  it("uses only the Latin words of a mixed name", () => {
    expect(clientInitials("บริษัท ABC Trading จำกัด")).toBe("AT");
  });

  it("returns empty for an empty name", () => {
    expect(clientInitials("")).toBe("");
  });
});

describe("normalizeHex", () => {
  it("expands #rgb and lowercases", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
  });

  it("rejects invalid values", () => {
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
});

describe("contrastText", () => {
  it("uses dark text on light backgrounds and white on dark", () => {
    expect(contrastText("#ffffff")).toBe("#171717");
    expect(contrastText("#000000")).toBe("#ffffff");
    expect(contrastText("#2563eb")).toBe("#ffffff");
  });
});

describe("resolveInitials", () => {
  it("prefers the configured abbreviation", () => {
    expect(resolveInitials("บริษัท ไดฟ์ เทอร์มินอล จำกัด", "DTN")).toBe("DTN");
  });

  it("falls back to the name when no abbreviation is set", () => {
    expect(resolveInitials("Drive Terminal Co., Ltd.", null)).toBe("DT");
  });
});

describe("client codes", () => {
  it("normalizes typed codes to uppercase A-Z0-9 max 4", () => {
    expect(normalizeClientCode("dtn-1")).toBe("DTN1");
    expect(normalizeClientCode("ABCDE")).toBe("ABCD");
  });

  it("validates the 1-4 uppercase alphanumeric format", () => {
    expect(isValidClientCode("DTN")).toBe(true);
    expect(isValidClientCode("C001")).toBe(true);
    expect(isValidClientCode("")).toBe(false);
    expect(isValidClientCode("ABCDE")).toBe(false);
    expect(isValidClientCode("D-T")).toBe(false);
  });

  it("suggests initials first, then a digit, then a sequential code", () => {
    expect(suggestClientCode("Drive Terminal Co., Ltd.")).toBe("DT");
    expect(suggestClientCode("Drive Terminal Co., Ltd.", ["DT"])).toBe("DT1");
    expect(suggestClientCode("บริษัท ไดฟ์ เทอร์มินอล จำกัด")).toBe("C001");
    expect(suggestClientCode("บริษัท ไดฟ์ เทอร์มินอล จำกัด", ["C001", "C002"])).toBe("C003");
  });
});
