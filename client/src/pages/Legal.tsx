import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import PublicFooter from "@/components/PublicFooter";
import { ArrowLeft, FileText, Shield } from "lucide-react";

type LegalKind = "impressum" | "datenschutz" | "agb" | "avv" | "launch";

const LEGAL_PLACEHOLDER = "TODO: vor Launch mit echten Anbieter- und Kontaktdaten ersetzen";

const CONTENT: Record<LegalKind, { title: string; subtitle: string; sections: Array<{ heading: string; body: string[] }> }> = {
  impressum: {
    title: "Impressum",
    subtitle: "Anbieterkennzeichnung nach § 5 DDG. Platzhalter vor Veröffentlichung ersetzen.",
    sections: [
      { heading: "Anbieter", body: [LEGAL_PLACEHOLDER, "TestForge / Betreiber: TODO Name oder Firma", "Adresse: TODO Straße, PLZ, Ort, Land"] },
      { heading: "Kontakt", body: ["E-Mail: TODO legal@testforge.dev", "Telefon: TODO optional", "Website: TODO https://testforge.dev"] },
      { heading: "Vertretungsberechtigte Person", body: ["TODO Name, Funktion"] },
      { heading: "Register / Umsatzsteuer", body: ["Handelsregister: TODO falls vorhanden", "Registernummer: TODO falls vorhanden", "Umsatzsteuer-ID: TODO falls vorhanden"] },
      { heading: "Verantwortlich für Inhalte", body: ["TODO Name und Anschrift, soweit erforderlich."] },
      { heading: "Hinweis", body: ["Diese Seite ist eine technische Startvorlage und ersetzt keine rechtliche Prüfung."] },
    ],
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    subtitle: "Startvorlage für eine DSGVO-orientierte Datenschutzerklärung für TestForge.",
    sections: [
      { heading: "Verantwortlicher", body: [LEGAL_PLACEHOLDER, "Verantwortlicher: TODO Betreiber", "Kontakt: TODO privacy@testforge.dev"] },
      { heading: "Welche Daten verarbeitet TestForge?", body: ["Accountdaten wie E-Mail, Name, Login-Methode und Plan.", "Analyse-Inhalte wie hochgeladene Spezifikationen, ZIP-Dateien, Repository-Metadaten, Analyseergebnisse, Reports und generierte Test-Suites.", "Nutzungsdaten wie Analyseanzahl, Status, Zeitpunkte, Fehlermeldungen und technische Logs.", "Optionale Integrationsdaten wie GitHub-URL, PR-URL oder vom Nutzer eingegebene Tokens. Tokens sollten nur temporär verarbeitet und nicht unnötig gespeichert werden."] },
      { heading: "Zwecke und Rechtsgrundlagen", body: ["Bereitstellung des Dienstes und Durchführung von Analysen: Art. 6 Abs. 1 lit. b DSGVO.", "Sicherheit, Missbrauchsschutz, Fehleranalyse und Produktverbesserung: Art. 6 Abs. 1 lit. f DSGVO.", "Abrechnung und steuerliche Pflichten, sobald Payments aktiv sind: Art. 6 Abs. 1 lit. c DSGVO.", "Einwilligungspflichtige Analytics oder Marketing-Cookies nur nach Einwilligung: Art. 6 Abs. 1 lit. a DSGVO."] },
      { heading: "Aufbewahrung", body: ["Analyseartefakte werden standardmäßig mit Retention-Metadaten versehen. Vor Launch sollte die konkrete Speicherfrist festgelegt werden, z. B. 30 Tage für Free/Pay-per-Analysis und abweichende Fristen für Enterprise.", "Account- und Abrechnungsdaten werden nach gesetzlichen Vorgaben gespeichert."] },
      { heading: "Empfänger und Dienstleister", body: ["Hosting, Datenbank, Objekt-Storage, E-Mail, Payment und LLM/API-Anbieter sind vor Launch konkret zu benennen.", "Wenn Kundendaten im Auftrag verarbeitet werden, sollte ein AVV nach Art. 28 DSGVO bereitgestellt werden."] },
      { heading: "Betroffenenrechte", body: ["Nutzer haben Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Aufsichtsbehörde.", "Kontakt für Datenschutzanfragen: TODO privacy@testforge.dev"] },
      { heading: "Cookies und Analytics", body: ["Notwendige Cookies können für Login und Sicherheit eingesetzt werden.", "Nicht notwendige Analytics-/Marketing-Technologien sollten erst nach Consent aktiviert werden."] },
      { heading: "Wichtiger Hinweis", body: ["Diese Datenschutzerklärung ist eine Startvorlage. Vor Livegang müssen Anbieter, Dienstleister, Speicherfristen, Drittlandtransfers und technische Maßnahmen konkretisiert und rechtlich geprüft werden."] },
    ],
  },
  agb: {
    title: "AGB",
    subtitle: "Startvorlage für Nutzungsbedingungen. Vor kommerziellem Launch rechtlich prüfen lassen.",
    sections: [
      { heading: "Geltungsbereich", body: ["Diese Bedingungen gelten für die Nutzung von TestForge, einem Tool zur Analyse von Spezifikationen, Code und APIs sowie zur Generierung von Test-Suites."] },
      { heading: "Leistungsbeschreibung", body: ["TestForge erzeugt automatisierte Analyseberichte und Testartefakte. Ergebnisse sind technische Hilfsmittel und ersetzen keine manuelle Prüfung, Rechtsberatung, Security-Audit-Garantie oder Pentest-Zertifizierung."] },
      { heading: "Free Run und Usage Limits", body: ["Zum Launch kann ein kostenloser Erstlauf pro Nutzer vorgesehen sein. Weitere Analysen können über Credits, Pay-per-Analysis oder Team-/Enterprise-Pläne freigeschaltet werden.", "Missbrauch, Umgehung von Limits oder automatisierte Massenregistrierung kann zur Sperrung führen."] },
      { heading: "Pflichten der Nutzer", body: ["Nutzer dürfen nur Inhalte hochladen oder Repositories analysieren, für die sie berechtigt sind.", "Keine illegalen Inhalte, keine fremden Secrets ohne Berechtigung, keine Angriffe auf fremde Systeme.", "Live-Test-Ausführung darf nur gegen Systeme erfolgen, für die der Nutzer eine Testberechtigung hat."] },
      { heading: "Verfügbarkeit", body: ["Es besteht kein Anspruch auf unterbrechungsfreie Verfügbarkeit, soweit kein gesonderter Enterprise-SLA vereinbart ist."] },
      { heading: "Haftung", body: ["Die Haftung sollte vor Launch anwaltlich formuliert werden. Insbesondere sind Grenzen für indirekte Schäden, Datenverlust, entgangenen Gewinn und Fehlentscheidungen aufgrund von Analyseergebnissen zu prüfen."] },
      { heading: "Kündigung und Sperrung", body: ["Accounts können bei Verstößen gegen diese Bedingungen oder Sicherheitsrisiken gesperrt werden."] },
      { heading: "Änderungen", body: ["Änderungen an diesen Bedingungen werden in geeigneter Weise bekannt gegeben."] },
    ],
  },
  avv: {
    title: "Auftragsverarbeitungsvertrag (AVV)",
    subtitle: "Checkliste/Startvorlage für Art. 28 DSGVO, falls Kunden personenbezogene Daten in Specs, Code oder Testdaten hochladen.",
    sections: [
      { heading: "Rollen", body: ["Kunde: Verantwortlicher im Sinne der DSGVO.", "TestForge-Betreiber: Auftragsverarbeiter, soweit personenbezogene Daten im Auftrag verarbeitet werden."] },
      { heading: "Gegenstand der Verarbeitung", body: ["Analyse von Spezifikationen, Code, Repository-Metadaten, Testdaten, generierten Reports und Test-Suites."] },
      { heading: "Kategorien personenbezogener Daten", body: ["Je nach Upload: Namen, E-Mails, Kundendaten, Patienten-/Finanzdaten, IDs, Rollen, Auditdaten oder sonstige vom Kunden bereitgestellte Daten."] },
      { heading: "Technische und organisatorische Maßnahmen", body: ["Zugriffskontrolle, Verschlüsselung, Retention, Secret-Redaction, Authentifizierung, SSRF-Schutz, Upload-Limits, Protokollierung und Löschkonzept konkret dokumentieren."] },
      { heading: "Unterauftragsverarbeiter", body: ["Hosting, Storage, Datenbank, LLM/API-Anbieter, E-Mail, Payment und Monitoring vor Launch vollständig aufführen."] },
      { heading: "Löschung und Rückgabe", body: ["Analyseartefakte nach vereinbarter Retention löschen oder auf Kundenanfrage exportieren/löschen."] },
      { heading: "Status", body: ["Diese Seite ist keine finale AVV, sondern die technische Launch-Vorbereitung. Für B2B-Verkauf sollte ein geprüfter AVV als PDF/HTML bereitstehen."] },
    ],
  },
  launch: {
    title: "Launch Checklist",
    subtitle: "Was vor dem öffentlichen Launch erledigt sein muss.",
    sections: [
      { heading: "Produkt", body: ["Demo-Analyse öffentlich erreichbar.", "1 kostenlose Analyse pro Nutzer aktiv.", "Pay-per-Analysis CTA sichtbar.", "Fehlerzustände, Limits und Upgrade-Hinweise klar formuliert."] },
      { heading: "Recht", body: ["Impressum mit echten Anbieterangaben.", "Datenschutzerklärung mit konkreten Dienstleistern, Speicherfristen und Kontakt.", "AGB final geprüft.", "AVV für B2B-Kunden vorbereitet.", "Cookie-/Analytics-Consent prüfen, falls nicht notwendige Tools aktiv sind."] },
      { heading: "Security", body: ["Upload-Härtung aktiv.", "SSRF-Schutz aktiv.", "Security-Headers aktiv.", "Secrets nicht in Logs/Reports.", "Rate Limits und Abuse Monitoring für öffentliche Endpunkte."] },
      { heading: "Betrieb", body: ["Deployment-URL final.", "Datenbank/Storage-Backups.", "Monitoring und Error Alerts.", "Support-E-Mail eingerichtet.", "Retention/Löschprozess definiert."] },
      { heading: "Go-to-Market", body: ["Landingpage mit klarem Versprechen.", "Pricing mit Free Run + Credits.", "3 Beispielanalysen/Case Studies.", "Feedback-Kanal.", "Liste echter Ziel-Repos für Beta-Test."] },
    ],
  },
};

export default function Legal({ kind }: { kind: LegalKind }) {
  const page = CONTENT[kind];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border/50 h-14 flex items-center sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" /> Zurück
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            {kind === "datenschutz" ? <Shield className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
            <span className="text-sm font-medium">{page.title}</span>
          </div>
        </div>
      </nav>

      <main className="container max-w-4xl py-12">
        <div className="mb-8 rounded-2xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-primary mb-3">TestForge Launch Legal</p>
          <h1 className="text-3xl font-black mb-3">{page.title}</h1>
          <p className="text-muted-foreground">{page.subtitle}</p>
        </div>

        <div className="space-y-5">
          {page.sections.map((section) => (
            <section key={section.heading} className="rounded-xl border border-border bg-card/80 p-5">
              <h2 className="font-bold mb-3">{section.heading}</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
