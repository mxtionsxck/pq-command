import type { NextConfig } from "next";

const isDevelopment = process.env["NODE_ENV"] !== "production";
const scriptSrc = isDevelopment
	? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
	: "script-src 'self' 'unsafe-inline'";

const nextConfig: NextConfig = {
	output: "standalone",
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
			{
				protocol: "http",
				hostname: "**",
			},
		],
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Permissions-Policy",
						value:
							"camera=(), microphone=(), geolocation=(), browsing-topics=()",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains; preload",
					},
					{
						key: "Content-Security-Policy",
						value:
							`default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; ${scriptSrc}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; upgrade-insecure-requests`,
					},
				],
			},
		];
	},
};

export default nextConfig;
