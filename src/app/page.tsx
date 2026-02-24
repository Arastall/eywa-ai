import { HeroSection } from "@/components/HeroSection";
import { DashboardSection } from "@/components/DashboardSection";
import { PMSIntegrations } from "@/components/PMSIntegrations";

export default function Home() {
  return (
    <main className="relative">
      <HeroSection />
      <DashboardSection />
      <PMSIntegrations />

      {/* Footer */}
      <footer className="py-16 px-4 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            <span className="text-gradient">EYWA</span>
            <span className="text-cyan-400/60 text-xl ml-2">AI</span>
          </h2>
          <p className="text-gray-500 mb-8">
            The neural network connecting hotels to infinite possibilities
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <a href="#" className="hover:text-cyan-400 transition-colors">
              About
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              Integrations
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              Pricing
            </a>
            <a href="#" className="hover:text-cyan-400 transition-colors">
              Contact
            </a>
          </div>
          <p className="text-gray-700 text-xs mt-8">
            © 2026 Eywa AI • Cenaia Labs
          </p>
        </div>
      </footer>
    </main>
  );
}
