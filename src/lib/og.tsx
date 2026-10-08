// Social-preview cards and app icons.
//
// A link shared on WhatsApp is how most of this restaurant's customers will
// first meet the site, and the card is all they see of it. It is drawn here
// rather than shipped as a picture so that it follows the brand, and so a
// product link can carry that product's own photograph and price.
//
// Two things about the renderer shape this file.
//
// 1. It shapes Arabic letters correctly but lays words out left to right, so
//    a sentence reads backwards. `Rtl` fixes that by making each word its own
//    flex item in a `row-reverse` row, which also gives the right wrapping
//    behaviour (a second line starts at the right). Latin text and numbers
//    stay inside their own word and keep their order.
// 2. A photo that fails to load must not fail the card. A broken link preview
//    is worse than a plain one, so every photo goes through `loadPhoto`,
//    which answers null on any problem and lets the card fall back.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { prisma } from "./db";
import { isAllowedPhotoUrl } from "./photo-hosts";
import { productImageUrl } from "./product-image";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const BRAND = {
  red: "#a8261c",
  redDeep: "#7d1a13",
  gold: "#f4c95d",
  cream: "#fbf7f1",
  ink: "#14100b",
} as const;

let fontCache: Promise<ArrayBuffer> | undefined;

/** Cairo Bold, bundled: a link card is not worth a font download per render. */
export function ogFonts() {
  fontCache ??= readFile(join(process.cwd(), "src/assets/fonts/Cairo-Bold.ttf")).then(
    (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  );
  return fontCache.then((data) => [
    { name: "Cairo", data, weight: 700 as const, style: "normal" as const },
  ]);
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function toDataUri(contentType: string, bytes: Uint8Array): string | null {
  // The renderer reads JPEG and PNG; WebP would fail the whole card.
  if (!/^image\/(jpeg|png)$/.test(contentType) || bytes.byteLength > MAX_PHOTO_BYTES) return null;
  return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** A remote photo as a data URI, or null on any problem at all. */
export async function loadPhoto(url: string | null | undefined, timeoutMs = 3000): Promise<string | null> {
  if (!url || !isAllowedPhotoUrl(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    return toDataUri(type, new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

interface PhotoSource {
  id: string;
  slug: string;
  imageUrl: string | null;
}

/** A product's photograph: the one the restaurant uploaded, else its URL. */
export async function loadProductPhoto(product: PhotoSource): Promise<string | null> {
  try {
    const uploaded = await prisma.productImage.findUnique({
      where: { productId: product.id },
      select: { contentType: true, data: true },
    });
    if (uploaded) return toDataUri(uploaded.contentType, uploaded.data);
  } catch {
    // Fall through to the URL; a database blip must not blank the card.
  }
  const url = productImageUrl({ slug: product.slug, imageUrl: product.imageUrl });
  return loadPhoto(url.startsWith("http") ? url : null);
}

let logoCache: Promise<string> | undefined;

/** The logo as a data URI, since the renderer cannot resolve a relative URL. */
export function logoDataUri(): Promise<string> {
  logoCache ??= readFile(join(process.cwd(), "public/brand/logo.svg")).then(
    (buffer) => `data:image/svg+xml;base64,${buffer.toString("base64")}`,
  );
  return logoCache;
}

/**
 * Arabic text, in reading order. Each word is a flex item in a reversed row,
 * so the first word sits at the right and a long line wraps from the right.
 */
export function Rtl({
  text,
  size,
  color = "#ffffff",
  style,
}: {
  text: string;
  size: number;
  color?: string;
  style?: CSSProperties;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        flexWrap: "wrap",
        fontSize: size,
        lineHeight: 1.25,
        color,
        ...style,
      }}
    >
      {words.map((word, index) => (
        // A margin, not `gap`: the renderer drops `gap` between some shaped
        // words and the sentence runs together.
        <div key={index} style={{ display: "flex", marginLeft: Math.round(size * 0.3) }}>
          {word}
        </div>
      ))}
    </div>
  );
}

/** The restaurant's lead photograph: the featured dish that is on sale. */
export async function loadLeadPhoto(): Promise<string | null> {
  try {
    const product = await prisma.product.findFirst({
      where: { featured: true, availability: "AVAILABLE" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, imageUrl: true },
    });
    return product ? await loadProductPhoto(product) : null;
  } catch {
    return null;
  }
}

function Backdrop({ photo, children }: { photo: string | null; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: `linear-gradient(135deg, ${BRAND.red} 0%, ${BRAND.redDeep} 100%)`,
        fontFamily: "Cairo",
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by the OG engine, not the browser
        <img
          src={photo}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: "absolute", top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height, objectFit: "cover" }}
          alt=""
        />
      ) : (
        // No photograph: a gold ring keeps the card from being a flat slab.
        <div
          style={{
            position: "absolute",
            left: -140,
            top: 60,
            width: 560,
            height: 560,
            borderRadius: 280,
            border: `44px solid ${BRAND.gold}`,
            opacity: 0.18,
          }}
        />
      )}
      {/* Keeps the text readable whatever the photograph is. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          background: photo
            ? // rgba(), not 8-digit hex: the renderer ignores the alpha pair and
              // paints nothing, which leaves white text over a bright photograph.
              "linear-gradient(270deg, rgba(125,26,19,0.95) 0%, rgba(125,26,19,0.86) 50%, rgba(20,16,11,0.25) 100%)"
            : "transparent",
        }}
      />
      {children}
    </div>
  );
}

/** The home card: name, promise, place. */
export async function renderBrandCard(photo: string | null): Promise<ReactElement> {
  const logo = await logoDataUri();
  return (
    <Backdrop photo={photo}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
          padding: "0 76px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- OG engine */}
          <img src={logo} width={116} height={116} alt="" />
          <Rtl text="بيتزا هاوس" size={118} />
        </div>
        <Rtl text="اطلب مسبقًا، استلم طازجًا" size={56} color={BRAND.gold} style={{ marginTop: 26 }} />
        <Rtl text="المكلا · فوه · حي المساكن" size={36} style={{ marginTop: 22, opacity: 0.92 }} />
        <div style={{ display: "flex", fontSize: 28, marginTop: 30, opacity: 0.8, color: "#ffffff" }}>
          Pizza House · Order ahead, pick up fresh
        </div>
      </div>
    </Backdrop>
  );
}

/** A product card: its photograph, its name, what it costs. */
export async function renderProductCard({
  photo,
  category,
  nameAr,
  nameEn,
  price,
}: {
  photo: string | null;
  category: string;
  nameAr: string;
  nameEn: string;
  price: string;
}): Promise<ReactElement> {
  const logo = await logoDataUri();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        fontFamily: "Cairo",
        background: `linear-gradient(135deg, ${BRAND.red} 0%, ${BRAND.redDeep} 100%)`,
      }}
    >
      {/* Photograph on the left; the text panel reads from the right. */}
      <div
        style={{
          display: "flex",
          width: 480,
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: photo ? "transparent" : BRAND.redDeep,
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- OG engine
          <img src={photo} width={480} height={OG_SIZE.height} style={{ objectFit: "cover" }} alt="" />
        ) : (
          // No photograph yet: the mark, large, rather than an empty column.
          // eslint-disable-next-line @next/next/no-img-element -- OG engine
          <img src={logo} width={300} height={300} style={{ opacity: 0.95 }} alt="" />
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "56px 60px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%" }}>
          <Rtl text={category} size={34} color={BRAND.gold} />
          <Rtl text={nameAr} size={nameAr.length > 22 ? 60 : 72} style={{ marginTop: 14 }} />
          <div
            style={{
              display: "flex",
              fontSize: 30,
              marginTop: 14,
              opacity: 0.85,
              color: "#ffffff",
              textAlign: "right",
            }}
          >
            {nameEn}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 26 }}>
          <div
            style={{
              display: "flex",
              background: BRAND.gold,
              borderRadius: 999,
              padding: "10px 34px",
            }}
          >
            <Rtl text={`ابتداءً من ${price}`} size={44} color={BRAND.ink} />
          </div>
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- OG engine */}
            <img src={logo} width={56} height={56} alt="" />
            <Rtl text="بيتزا هاوس · المكلا" size={34} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A square app icon: the logo on the brand red, with room for a mask. */
export async function renderIcon(size: number, maskable: boolean): Promise<ReactElement> {
  const logo = await logoDataUri();
  // A maskable icon is cropped to a circle or squircle by the launcher, so
  // the artwork must sit inside the central ~60%; an ordinary icon can fill.
  const inner = Math.round(size * (maskable ? 0.58 : 0.86));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: maskable ? BRAND.red : "transparent",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- OG engine */}
      <img src={logo} width={inner} height={inner} alt="" />
    </div>
  );
}
