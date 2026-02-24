"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AnimatedCounter } from "./AnimatedCounter";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Central glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />

      <div className="relative z-10 text-center max-w-5xl mx-auto">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, type: "spring" }}
          className="mb-8"
        >
          <h1 className="text-7xl md:text-9xl font-bold tracking-tight">
            <span className="text-gradient">EYWA</span>
            <span className="text-cyan-400/80 text-4xl md:text-5xl ml-2 align-super">
              AI
            </span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto"
        >
          The neural network connecting your hotel
          <br />
          <span className="text-cyan-400">to infinite revenue possibilities</span>
        </motion.p>

        {/* Main ROI highlight */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="glass-card p-8 md:p-12 max-w-3xl mx-auto mb-12"
        >
          <p className="text-gray-400 text-lg mb-4">
            Average Revenue Increase with Eywa
          </p>
          <div className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 mb-4">
            +<AnimatedCounter value={47} suffix="%" duration={2.5} />
          </div>
          <p className="text-gray-500">
            Based on 127 hotels connected through our neural network
          </p>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
        >
          {[
            { value: 2847, suffix: "%", label: "Average ROI" },
            { value: 40, suffix: "h", label: "Saved per week" },
            { value: 127, suffix: "", label: "Hotels connected" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  duration={2 + i * 0.3}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="mt-12"
        >
          <Link href="/register" className="group relative inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full text-lg font-semibold overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/25">
            <span className="relative z-10">Connect Your Hotel</span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 border-2 border-cyan-400/30 rounded-full flex justify-center pt-2"
        >
          <div className="w-1.5 h-3 bg-cyan-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
