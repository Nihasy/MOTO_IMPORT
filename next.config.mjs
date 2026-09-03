const enProduction = process.env.NODE_ENV === "production";

/**
 * `unsafe-eval` n'est nécessaire qu'au rechargement à chaud du mode
 * développement. En production, l'autoriser reviendrait à désarmer une part
 * essentielle de la protection contre l'injection de script.
 */
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(enProduction ? [] : ["'unsafe-eval'"]),
  "https://va.vercel-scripts.com",
].join(" ");

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  "connect-src 'self' https://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // `upgrade-insecure-requests` reecrit toute sous-ressource http en https.
  // Le navigateur exempte `localhost`, mais pas une adresse IP : depuis un
  // telephone du reseau local, la page arrive et tous ses fichiers CSS et JS
  // echouent. Cette directive n'a de sens que servie en TLS.
  ...(enProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const enTetesSecurite = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Deux ans, sous-domaines inclus : la première visite en clair est le seul
  // moment interceptable, HSTS le referme pour toutes les suivantes. Inutile
  // hors production, ou rien n'est servi en TLS.
  ...(enProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ne pas annoncer la pile technique : c'est du renseignement gratuit.
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: enTetesSecurite },
      {
        // Le back-office et les API ne doivent jamais être mis en cache par
        // un intermédiaire : leurs réponses sont propres à une session.
        source: "/(admin|api|connexion)/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" }],
      },
    ];
  },
};

export default nextConfig;
