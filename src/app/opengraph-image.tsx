import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siteConfig } from "@/lib/metadata";

export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logotipo/specular-logotipo-white.svg"));
  const logoSrc = `data:image/svg+xml;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: siteConfig.themeColor.dark,
          color: siteConfig.themeColor.light,
          fontFamily: "sans-serif",
        }}
      >
        <img src={logoSrc} width={560} height={120} alt="" />
        <div style={{ fontSize: 36, color: "#8e8e93", marginTop: 48, lineHeight: 1.3, maxWidth: 960 }}>
          {siteConfig.description}
        </div>
      </div>
    ),
    size,
  );
}
