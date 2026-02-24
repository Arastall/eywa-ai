"use client";

import { motion } from "framer-motion";
import { Check, Plug } from "lucide-react";

const integrations = [
  { name: "Mews", status: "live", logo: "🔵" },
  { name: "Cloudbeds", status: "coming", logo: "☁️" },
  { name: "Opera PMS", status: "coming", logo: "🎭" },
  { name: "RoomRaccoon", status: "coming", logo: "🦝" },
  { name: "Guesty", status: "coming", logo: "🏠" },
  { name: "Hostaway", status: "coming", logo: "✈️" },
];

export function PMSIntegrations() {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            One Network, <span className="text-gradient">All Systems</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Eywa connects to your existing PMS and channels in minutes
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {integrations.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className={`
                glass-card p-6 text-center relative
                ${integration.status === "live" ? "border-cyan-400/50" : "border-gray-700/50"}
              `}
            >
              {integration.status === "live" && (
                <div className="absolute -top-2 -right-2 bg-cyan-500 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Live
                </div>
              )}
              
              <div className="text-4xl mb-3">{integration.logo}</div>
              <h3 className="text-lg font-semibold mb-1">{integration.name}</h3>
              <p className="text-sm text-gray-500">
                {integration.status === "live" ? (
                  <span className="text-cyan-400">Connected</span>
                ) : (
                  "Coming soon"
                )}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 flex items-center justify-center gap-2">
            <Plug className="w-4 h-4" />
            Custom API integrations available
          </p>
        </motion.div>
      </div>
    </section>
  );
}
