import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/core/basePath";

const nextConfig: NextConfig = {
  // Served under a sub-path on the shared cpr-one Apache host.
  basePath: BASE_PATH,
};

export default nextConfig;
