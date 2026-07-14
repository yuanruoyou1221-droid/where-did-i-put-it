import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/icons", { recursive: true });
await mkdir("assets", { recursive: true });

const source = await readFile("public/icons/app-icon.svg");

for (const size of [192, 512]) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(`public/icons/app-icon-${size}.png`);
}

const appIcon = await sharp(source).resize(1024, 1024).png().toBuffer();
await sharp(appIcon).toFile("assets/icon-only.png");

const splashIcon = await sharp(source).resize(720, 720).png().toBuffer();
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: "#fbf8f1",
  },
})
  .composite([{ input: splashIcon, gravity: "center" }])
  .png()
  .toFile("assets/splash.png");

console.log("PWA and Android source icons generated.");
