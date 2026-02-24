import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        eywa: {
          cyan: "#00f5ff",
          purple: "#9945ff",
          green: "#14f195",
          blue: "#0ea5e9",
          dark: "#0a0a1a",
          darker: "#050510",
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "counter": "counter 2s ease-out forwards",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.8", filter: "brightness(1.3)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backgroundImage: {
        "eywa-gradient": "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a1a 100%)",
        "glow-radial": "radial-gradient(ellipse at center, rgba(0,245,255,0.15) 0%, transparent 70%)",
      },
    },
  },
  plugins: [],
};
export default config;
