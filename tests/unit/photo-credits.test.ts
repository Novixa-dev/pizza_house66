import { describe, expect, it } from "vitest";
import { wikimediaFileName } from "@/lib/photo-credits";

// The file name is parsed out of a thumbnail URL, so the parser is coupled to
// Wikimedia's URL shape. If that shape changes the integration test beside
// this one would quietly find nothing to check, so the shape is pinned here.

describe("wikimediaFileName", () => {
  it("reads the file name out of a thumbnail URL", () => {
    expect(
      wikimediaFileName(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Sfiha2.jpg/960px-Sfiha2.jpg"
      )
    ).toBe("Sfiha2.jpg");
  });

  it("decodes a name carrying escaped characters", () => {
    expect(
      wikimediaFileName(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/" +
          "Potato_wedges_at_Mensa_Paderborn_%2811956794164%29.jpg/" +
          "960px-Potato_wedges_at_Mensa_Paderborn_%2811956794164%29.jpg"
      )
    ).toBe("Potato_wedges_at_Mensa_Paderborn_(11956794164).jpg");
  });

  it("ignores every other source", () => {
    // Unsplash needs no attribution, a local file is ours, and an uploaded
    // photograph belongs to the restaurant.
    expect(wikimediaFileName("https://images.unsplash.com/photo-1513104890138?w=1000")).toBeNull();
    expect(wikimediaFileName("/menu/pepsi.svg")).toBeNull();
    expect(wikimediaFileName(null)).toBeNull();
    expect(wikimediaFileName(undefined)).toBeNull();
    expect(wikimediaFileName("")).toBeNull();
  });
});
