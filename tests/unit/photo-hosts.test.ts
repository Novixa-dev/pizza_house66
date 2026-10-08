import { describe, expect, it } from "vitest";
import { isAllowedPhotoUrl } from "@/lib/photo-hosts";

// The social-card renderer fetches a product's photo on the server. The URL
// is typed into the admin, so it must not be able to point the server at
// anything it likes.

describe("isAllowedPhotoUrl", () => {
  it("allows the two hosts the image optimizer already allows", () => {
    expect(isAllowedPhotoUrl("https://images.unsplash.com/photo-1?w=1000&q=80")).toBe(true);
    expect(isAllowedPhotoUrl("https://upload.wikimedia.org/wikipedia/commons/9/9f/Fatayer.jpg")).toBe(true);
  });

  it("refuses other hosts, including look-alikes", () => {
    expect(isAllowedPhotoUrl("https://example.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://images.unsplash.com.evil.example/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://evil.example/images.unsplash.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("https://user@evil.example@images.unsplash.com/a.jpg")).toBe(false);
  });

  it("refuses plain http, other schemes and private addresses", () => {
    expect(isAllowedPhotoUrl("http://images.unsplash.com/a.jpg")).toBe(false);
    expect(isAllowedPhotoUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedPhotoUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedPhotoUrl("http://localhost:3000/a.jpg")).toBe(false);
  });

  it("refuses what is not a URL at all", () => {
    expect(isAllowedPhotoUrl("")).toBe(false);
    expect(isAllowedPhotoUrl("/menu/placeholder.svg")).toBe(false);
    expect(isAllowedPhotoUrl("not a url")).toBe(false);
  });
});
