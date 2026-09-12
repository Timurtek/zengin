import { Button, Card } from "@zengin/ui";

export function App() {
  return (
    <main className="app">
      <Card padding="lg">
        <h1 className="app__title">It runs.</h1>
        <p className="app__lead">Components live in src/components/ui and are yours to edit. The brand is src/theme/brand.css. The engine checks everything else.</p>
        <Button tone="primary" onClick={() => alert("Still on the system.")}>
          Get started
        </Button>
      </Card>
    </main>
  );
}
