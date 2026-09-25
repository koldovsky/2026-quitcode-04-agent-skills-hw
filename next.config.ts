import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev mode logs every Server Function call with its arguments, i.e. form fields and personal data.
  logging: {
    serverFunctions: false,
  },
};

export default nextConfig;
