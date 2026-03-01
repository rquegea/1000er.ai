import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/analysis/history",
        permanent: true,
      },
      {
        source: "/analytics",
        destination: "/analysis/analytics",
        permanent: true,
      },
      {
        source: "/stores",
        destination: "/settings/stores",
        permanent: true,
      },
      {
        source: "/users",
        destination: "/settings/team",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
