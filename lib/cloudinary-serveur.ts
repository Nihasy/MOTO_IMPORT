import { createHash } from "node:crypto";
import { CLOUD_NAME } from "./cloudinary";

/** Signature d'upload direct navigateur -> Cloudinary. */
export function signerUpload(params: Record<string, string | number>): {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
} {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.CLOUDINARY_API_SECRET ?? "";
  const tous: Record<string, string | number> = { ...params, timestamp };
  const aSigner = Object.keys(tous)
    .sort()
    .map((k) => `${k}=${tous[k]}`)
    .join("&");
  const signature = createHash("sha1").update(aSigner + secret).digest("hex");
  return {
    signature,
    timestamp,
    api_key: process.env.CLOUDINARY_API_KEY ?? "",
    cloud_name: CLOUD_NAME,
  };
}

export const cloudinaryConfigure = () =>
  Boolean(CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
