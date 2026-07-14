import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be used from other devices on the LAN
  // (phone on the same Wi-Fi). Without this, Next.js blocks cross-origin
  // dev asset requests and the app never hydrates on the phone.
  allowedDevOrigins: [
    "192.168.1.103",
    "192.168.1.102",
    "192.168.1.101",
    "192.168.1.104",
    "192.168.1.105",
    "192.168.0.*",
    "192.168.1.*",
    "192.168.29.*",
    "10.*",
    "172.28.128.1",
  ],
};

export default nextConfig;
