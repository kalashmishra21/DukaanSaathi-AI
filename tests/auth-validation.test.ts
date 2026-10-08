import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "../src/lib/auth/validation";

describe("auth form validation", () => {
  it("normalizes email and full name before account creation", () => {
    const result = signUpSchema.parse({ fullName: "  Demo Owner  ", email: "  OWNER@EXAMPLE.COM ", password: "demo-password", confirmPassword: "demo-password" });
    expect(result.fullName).toBe("Demo Owner");
    expect(result.email).toBe("owner@example.com");
  });

  it("rejects mismatched passwords at the confirmation field", () => {
    const result = signUpSchema.safeParse({ fullName: "Demo Owner", email: "owner@example.com", password: "demo-password", confirmPassword: "different-password" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("requires only email and password for sign in", () => {
    expect(signInSchema.safeParse({ email: "owner@example.com", password: "demo-password" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "owner@example.com", password: "" }).success).toBe(false);
  });
});
