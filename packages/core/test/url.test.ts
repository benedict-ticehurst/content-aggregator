import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "../src/url.js";

describe("canonicalizeUrl", () => {
  it("strips utm and other tracking params", () => {
    expect(
      canonicalizeUrl("https://example.com/a?utm_source=x&id=7&fbclid=abc&UTM_Campaign=y"),
    ).toBe("https://example.com/a?id=7");
  });

  it("lowercases the host and drops the fragment", () => {
    expect(canonicalizeUrl("https://Example.COM/Post#section")).toBe("https://example.com/Post");
  });

  it("removes trailing slashes but keeps the root", () => {
    expect(canonicalizeUrl("https://example.com/post/")).toBe("https://example.com/post");
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts query params so order doesn't create duplicates", () => {
    expect(canonicalizeUrl("https://example.com/s?b=2&a=1")).toBe(
      canonicalizeUrl("https://example.com/s?a=1&b=2"),
    );
  });

  it("throws on invalid URLs", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow();
  });
});