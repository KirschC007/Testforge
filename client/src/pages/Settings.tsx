import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, RotateCcw, Save, AlertTriangle,
  Layers, Shield, Code2, CheckCircle2, SlidersHorizontal
} from "lucide-react";

type SettingItem = {
  key: string;
  label: string;
  description: string;
  category: string;
  value: string;
  defaultValue: string;
  isCustomized: boolean;
  updatedAt: Date | null;
};

function PromptEditor({ item, onSave, onReset }: {
  item: SettingItem;
  onSave: (key: string, value: string) => void;
  onReset: (key: string) => void;
}) {
  const [value, setValue] = useState(item.value);
  const [isDirty, setIsDirty] = useState(false);
  const isLong = item.defaultValue.length > 100;

  const handleChange = (v: string) => {
    setValue(v);
    setIsDirty(v !== item.value);
  };

  const handleSave = () => {
    onSave(item.key, value);
    setIsDirty(false);
  };

  const handleReset = () => {
    setValue(item.defaultValue);
    setIsDirty(value !== item.defaultValue);
    onReset(item.key);
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              {item.label}
              {item.isCustomized && (
                <Badge variant="outline" className="border-amber-700 text-amber-300 text-xs">Angepasst</Badge>
              )}
              {isDirty && (
                <Badge variant="outline" className="border-blue-700 text-blue-300 text-xs">Ungespeichert</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-xs mt-1">{item.description}</CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            {item.isCustomized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Auf Standard zurücksetzen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              className="h-7 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Speichern
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLong ? (
          <Textarea
            value={value}
            onChange={e => handleChange(e.target.value)}
            className="font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-200 min-h-[200px] resize-y focus:border-violet-600"
            spellCheck={false}
          />
        ) : (
          <Input
            value={value}
            onChange={e => handleChange(e.target.value)}
            className="font-mono text-sm bg-zinc-950 border-zinc-700 text-zinc-200 focus:border-violet-600"
          />
        )}
        {item.isCustomized && item.updatedAt && (
          <p className="text-xs text-zinc-500 mt-2">
            Zuletzt geändert: {new Date(item.updatedAt).toLocaleString("de-DE")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: allSettings, isLoading, error } = trpc.settings.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
    retry: false,
  });

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`${vars.key} wurde aktualisiert.`);
      utils.settings.getAll.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const resetMutation = trpc.settings.reset.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`${vars.key} wurde auf Standard zurückgesetzt.`);
      utils.settings.getAll.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Bitte einloggen...</div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="bg-zinc-900 border-zinc-800 max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Kein Zugriff
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Die Einstellungen sind nur für Administratoren zugänglich.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              <Link href="/dashboard">← Zurück zum Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const promptSettings = allSettings?.filter(s => s.category === "prompts") ?? [];
  const pipelineSettings = allSettings?.filter(s => s.category === "pipeline") ?? [];

  const handleSave = (key: string, value: string) => {
    updateMutation.mutate({ key, value });
  };

  const handleReset = (key: string) => {
    resetMutation.mutate({ key });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <Separator orientation="vertical" className="h-5 bg-zinc-700" />
          <h1 className="font-semibold text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-violet-400" />
            Einstellungen
          </h1>
          <Badge variant="outline" className="ml-auto border-zinc-700 text-zinc-400 text-xs">Admin</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Warning Banner */}
        <div className="flex gap-3 p-4 rounded-lg border border-amber-800 bg-amber-950/30 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <strong>Achtung:</strong> Änderungen an System-Prompts wirken sich sofort auf alle neuen Analyse-Jobs aus.
            Der In-Memory-Cache wird bei jeder Änderung invalidiert. Teste Änderungen zuerst mit einer kleinen Spec.
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <div className="animate-spin w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full mr-3" />
            Einstellungen werden geladen...
          </div>
        )}

        {error && (
          <div className="flex gap-3 p-4 rounded-lg border border-red-800 bg-red-950/30">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="text-sm text-red-200">Fehler beim Laden: {error.message}</div>
          </div>
        )}

        {allSettings && (
          <Tabs defaultValue="prompts">
            <TabsList className="bg-zinc-900 border border-zinc-800 mb-8">
              <TabsTrigger value="prompts" className="data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300">
                <Layers className="w-4 h-4 mr-2" />
                System-Prompts
                {promptSettings.some(s => s.isCustomized) && (
                  <Badge className="ml-2 bg-amber-800 text-amber-200 text-xs px-1.5 py-0">
                    {promptSettings.filter(s => s.isCustomized).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="data-[state=active]:bg-violet-900/50 data-[state=active]:text-violet-300">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Pipeline-Parameter
                {pipelineSettings.some(s => s.isCustomized) && (
                  <Badge className="ml-2 bg-amber-800 text-amber-200 text-xs px-1.5 py-0">
                    {pipelineSettings.filter(s => s.isCustomized).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prompts" className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-violet-400" />
                  System-Prompts
                </h2>
                <p className="text-sm text-zinc-400">
                  Diese Prompts steuern das Verhalten der KI in jeder Pipeline-Schicht.
                  Änderungen werden sofort wirksam (kein Server-Neustart nötig).
                </p>
              </div>

              {/* Schicht 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-300">1</div>
                  <h3 className="text-sm font-semibold text-zinc-300">Schicht 1 — Spec-Parser</h3>
                </div>
                {promptSettings
                  .filter(s => s.key.startsWith("prompt.layer1"))
                  .map(item => (
                    <PromptEditor key={item.key} item={item} onSave={handleSave} onReset={handleReset} />
                  ))}
              </div>

              <Separator className="bg-zinc-800" />

              {/* Schicht 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-cyan-900 flex items-center justify-center text-xs font-bold text-cyan-300">3</div>
                  <h3 className="text-sm font-semibold text-zinc-300">Schicht 3 — Test-Generator</h3>
                </div>
                {promptSettings
                  .filter(s => s.key.startsWith("prompt.layer3"))
                  .map(item => (
                    <PromptEditor key={item.key} item={item} onSave={handleSave} onReset={handleReset} />
                  ))}
              </div>

              <Separator className="bg-zinc-800" />

              {/* LLM Checker */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-900 flex items-center justify-center text-xs font-bold text-amber-300">5</div>
                  <h3 className="text-sm font-semibold text-zinc-300">Schicht 5 — LLM Checker</h3>
                </div>
                {promptSettings
                  .filter(s => s.key.startsWith("prompt.llmchecker"))
                  .map(item => (
                    <PromptEditor key={item.key} item={item} onSave={handleSave} onReset={handleReset} />
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-violet-400" />
                  Pipeline-Parameter
                </h2>
                <p className="text-sm text-zinc-400">
                  Numerische Konfigurationswerte für die Analyse-Pipeline.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pipelineSettings.map(item => (
                  <PromptEditor key={item.key} item={item} onSave={handleSave} onReset={handleReset} />
                ))}
              </div>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Umgebungsvariablen (read-only)
                  </CardTitle>
                  <CardDescription className="text-zinc-400 text-xs">
                    Diese Werte werden über Umgebungsvariablen gesetzt und können hier nicht geändert werden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      ["DATABASE_URL", "Datenbank-Verbindung"],
                      ["JWT_SECRET", "Session-Cookie-Signing"],
                      ["BUILT_IN_FORGE_API_KEY", "LLM API-Key (automatisch)"],
                      ["BUILT_IN_FORGE_API_URL", "LLM API-Endpoint (automatisch)"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <code className="text-violet-300 font-mono text-xs">{key}</code>
                        <span className="text-zinc-500 text-xs">{desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
