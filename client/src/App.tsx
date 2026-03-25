import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AnalysisDetail from "./pages/AnalysisDetail";
import NewAnalysis from "./pages/NewAnalysis";
import Pricing from "@/pages/Pricing";
import Demo from "@/pages/Demo";
import SpecDiff from "./pages/SpecDiff";
import TestRunner from "./pages/TestRunner";
import Docs from "./pages/Docs";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/analysis/new" component={NewAnalysis} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/demo" component={Demo} />
      <Route path="/analysis/:id/diff" component={SpecDiff} />
      <Route path="/analysis/:id/run" component={TestRunner} />
      <Route path="/analysis/:id" component={AnalysisDetail} />
      <Route path="/docs" component={Docs} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
