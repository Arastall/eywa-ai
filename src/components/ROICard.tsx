"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";
import { TrendingUp, Clock, DollarSign, Zap } from "lucide-react";

interface ROICardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  description: string;
  icon: "trending" | "clock" | "dollar" | "zap";
  color: "cyan" | "purple" | "green";
  delay?: number;
}

const icons = {
  trending: TrendingUp,
  clock: Clock,
  dollar: DollarSign,
  zap: Zap,
};

const colors = {
  cyan: {
    gradient: "from-cyan-400/20 to-cyan-600/5",
    border: "border-cyan-400/30",
    text: "text-cyan-400",
    glow: "shadow-cyan-400/20",
  },
  purple: {
    gradient: "from-purple-400/20 to-purple-600/5",
    border: "border-purple-400/30",
    text: "text-purple-400",
    glow: "shadow-purple-400/20",
  },
  green: {
    gradient: "from-emerald-400/20 to-emerald-600/5",
    border: "border-emerald-400/30",
    text: "text-emerald-400",
    glow: "shadow-emerald-400/20",
  },
};

export function ROICard({
  title,
  value,
  prefix = "",
  suffix = "",
  description,
  icon,
  color,
  delay = 0,
}: ROICardProps) {
  const Icon = icons[icon];
  const colorScheme = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.02, y: -5 }}
      className={`
        relative overflow-hidden rounded-2xl p-6
        bg-gradient-to-br ${colorScheme.gradient}
        border ${colorScheme.border}
        shadow-xl ${colorScheme.glow}
        backdrop-blur-xl
      `}
    >
      {/* Glow effect */}
      <div
        className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${colorScheme.gradient} blur-3xl opacity-50`}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2 rounded-lg bg-gradient-to-br ${colorScheme.gradient} ${colorScheme.border} border`}
          >
            <Icon className={`w-5 h-5 ${colorScheme.text}`} />
          </div>
          <span className="text-sm text-gray-400 font-medium">{title}</span>
        </div>

        <div className={`text-4xl font-bold ${colorScheme.text} mb-2`}>
          <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
        </div>

        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {/* Animated border glow */}
      <motion.div
        className={`absolute inset-0 rounded-2xl border-2 ${colorScheme.border} opacity-0`}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: delay + 1 }}
      />
    </motion.div>
  );
}
