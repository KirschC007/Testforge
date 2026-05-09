import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AnalysisDetail = lazy(() => import("./pages/AnalysisDetail"));
const NewAnalysis = lazy(() => import("./pages/NewAnalysis"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Demo = lazy(() => import("./pages/Demo"));
const Evidence = lazy(() => import("./pages/Evidence"));
const SpecDiff = lazy(() => import("./pages/SpecDiff"));
const TestRunner = lazy(() => import("./pages/TestRunner"));
const Docs = lazy(() => import("./pages/Docs"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const Legal = lazy(() => import("./pages/Legal"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="rounded-2xl border border-border/70 bg-card/80 px-6 py-5 shadow-xl">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Loading TestForge...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/analysis/new" component={NewAnalysis} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/demo" component={Demo} />
        <Route path="/evidence" component={Evidence} />
        <Route path="/analysis/:id/diff" component={SpecDiff} />
        <Route path="/analysis/:id/run" component={TestRunner} />
        <Route path="/analysis/:id" component={AnalysisDetail} />
        <Route path="/docs" component={Docs} />
        <Route path="/settings" component={Settings} />
        <Route path="/login" component={Login} />
        <Route path="/impressum">{() => <Legal kind="impressum" />}</Route>
        <Route path="/datenschutz">{() => <Legal kind="datenschutz" />}</Route>
        <Route path="/agb">{() => <Legal kind="agb" />}</Route>
        <Route path="/avv">{() => <Legal kind="avv" />}</Route>
        <Route path="/launch-checklist">{() => <Legal kind="launch" />}</Route>
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
