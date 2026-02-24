"use client";

import { motion } from "framer-motion";
import { ROICard } from "./ROICard";
import { AnimatedCounter } from "./AnimatedCounter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// Fake data for demo
const revenueData = [
  { month: "Jan", before: 45000, after: 62000 },
  { month: "Feb", before: 48000, after: 71000 },
  { month: "Mar", before: 52000, after: 78000 },
  { month: "Apr", before: 49000, after: 85000 },
  { month: "May", before: 55000, after: 92000 },
  { month: "Jun", before: 58000, after: 98000 },
];

const occupancyData = [
  { day: "Mon", value: 78 },
  { day: "Tue", value: 82 },
  { day: "Wed", value: 91 },
  { day: "Thu", value: 88 },
  { day: "Fri", value: 95 },
  { day: "Sat", value: 98 },
  { day: "Sun", value: 85 },
];

export function DashboardSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Real-Time</span> Intelligence
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            See exactly how Eywa transforms your hotel&apos;s performance
          </p>
        </motion.div>

        {/* ROI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <ROICard
            title="Monthly Profit Boost"
            value={47850}
            prefix="€"
            description="Additional revenue vs. baseline"
            icon="dollar"
            color="cyan"
            delay={0}
          />
          <ROICard
            title="ROI"
            value={2847}
            suffix="%"
            description="Return on investment"
            icon="trending"
            color="purple"
            delay={0.1}
          />
          <ROICard
            title="Time Saved"
            value={40}
            suffix="h/week"
            description="Automated operations"
            icon="clock"
            color="green"
            delay={0.2}
          />
          <ROICard
            title="Revenue Per Room"
            value={185}
            prefix="€"
            suffix="/night"
            description="+38% vs industry avg"
            icon="zap"
            color="cyan"
            delay={0.3}
          />
        </div>

        {/* Big ROI Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass-card p-8 md:p-12 text-center mb-16 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/10 to-emerald-500/5" />
          <div className="relative z-10">
            <p className="text-gray-400 text-xl mb-4">
              Total 12-Month Profit Impact with Eywa
            </p>
            <div className="text-6xl md:text-8xl font-black mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400">
                €<AnimatedCounter value={574200} duration={3} />
              </span>
            </div>
            <p className="text-gray-500 text-lg">
              Average for a 50-room property • Your results may vary
            </p>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Comparison */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-6"
          >
            <h3 className="text-xl font-semibold mb-6">
              Revenue: <span className="text-gray-500">Before</span> vs{" "}
              <span className="text-cyan-400">After Eywa</span>
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorBefore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAfter" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(v) => `€${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a1a",
                      border: "1px solid rgba(0,245,255,0.2)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `€${value.toLocaleString()}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="before"
                    stroke="#6b7280"
                    fillOpacity={1}
                    fill="url(#colorBefore)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="after"
                    stroke="#00f5ff"
                    fillOpacity={1}
                    fill="url(#colorAfter)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Occupancy */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-6"
          >
            <h3 className="text-xl font-semibold mb-6">
              Occupancy Rate{" "}
              <span className="text-emerald-400 text-sm font-normal">
                +23% avg improvement
              </span>
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyData}>
                  <defs>
                    <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14f195" stopOpacity={1} />
                      <stop offset="95%" stopColor="#14f195" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a1a",
                      border: "1px solid rgba(20,241,149,0.2)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                  <Bar
                    dataKey="value"
                    fill="url(#colorOccupancy)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
