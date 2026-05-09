import { Link } from "wouter";
import { Shield } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer className="border-t border-border/50 py-6">
      <div className="container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5" />
          <span>TestForge</span>
          <span className="hidden sm:inline">Proof-grade tests for vibe-coded SaaS.</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing"><span className="hover:text-foreground transition-colors cursor-pointer">Pricing</span></Link>
          <Link href="/evidence"><span className="hover:text-foreground transition-colors cursor-pointer">Evidence</span></Link>
          <Link href="/launch-checklist"><span className="hover:text-foreground transition-colors cursor-pointer">Launch Checklist</span></Link>
          <Link href="/datenschutz"><span className="hover:text-foreground transition-colors cursor-pointer">Datenschutz</span></Link>
          <Link href="/agb"><span className="hover:text-foreground transition-colors cursor-pointer">AGB</span></Link>
          <Link href="/avv"><span className="hover:text-foreground transition-colors cursor-pointer">AVV</span></Link>
          <Link href="/impressum"><span className="hover:text-foreground transition-colors cursor-pointer">Impressum</span></Link>
        </div>
      </div>
    </footer>
  );
}
