import { Avatar, Badge, Button, Menu, Popover, Sheet, TextField, Tooltip } from "@zengin/ui";
import { useState, type ComponentType, type ReactNode } from "react";
import { Icon } from "../icons";

export type Page = "overview" | "customers" | "billing" | "settings";

const NAV: { page: Page; label: string; icon: ComponentType }[] = [
  { page: "overview", label: "Overview", icon: Icon.Overview },
  { page: "customers", label: "Customers", icon: Icon.Customers },
  { page: "billing", label: "Billing", icon: Icon.Billing },
  { page: "settings", label: "Settings", icon: Icon.Settings },
];

const TITLES: Record<Page, string> = { overview: "Overview", customers: "Customers", billing: "Billing", settings: "Settings" };

interface ShellProps {
  page: Page;
  onNavigate: (page: Page) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  children: ReactNode;
}

/** The frame every page sits in: sidebar navigation, a top bar with search and account, and the content column. */
export function Shell({ page, onNavigate, theme, onToggleTheme, children }: ShellProps) {
  const [drawer, setDrawer] = useState(false);
  const go = (p: Page) => {
    onNavigate(p);
    setDrawer(false);
  };

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary">
        <Navigation page={page} onNavigate={go} />
      </aside>

      <div className="main">
        <header className="topbar">
          <Sheet open={drawer} onOpenChange={setDrawer} side="left" size="sm">
            <Sheet.Trigger asChild>
              <Button className="topbar__menu" variant="ghost" size="sm" aria-label="Open navigation" leadingIcon={<Icon.Menu />} />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>Navigation</Sheet.Title>
              <div className="sidebar sidebar--sheet">
                <Navigation page={page} onNavigate={go} />
              </div>
            </Sheet.Content>
          </Sheet>
          <h1 className="topbar__title">{TITLES[page]}</h1>
          <TextField className="topbar__search" size="sm" placeholder="Search customers, invoices" aria-label="Search" leadingIcon={<Icon.Search />} />
          <div className="topbar__actions">
            <Popover size="sm">
              <Popover.Trigger asChild>
                <Button variant="ghost" size="sm" aria-label="Notifications, 3 unread" leadingIcon={<Icon.Bell />}>
                  <Badge tone="primary" size="sm">
                    3
                  </Badge>
                </Button>
              </Popover.Trigger>
              <Popover.Content align="end">
                <div className="notifications">
                  <span className="section-title">Notifications</span>
                  <div className="notifications__item">
                    <span>Halyard upgraded to Business</span>
                    <small>12 min ago</small>
                  </div>
                  <div className="notifications__item">
                    <span>Invoice INV-2381 paid by Northwind</span>
                    <small>2 h ago</small>
                  </div>
                  <div className="notifications__item">
                    <span>Sable will cancel at period end</span>
                    <small>Yesterday</small>
                  </div>
                </div>
              </Popover.Content>
            </Popover>
            <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
              <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
            </Tooltip>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function Navigation({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <>
      <div className="brand">
        <Avatar name="Acme" shape="square" size="md" />
        <div className="brand__meta">
          Acme
          <small>Business plan</small>
        </div>
      </div>
      <nav className="nav" aria-label="Pages">
        {NAV.map((item) => (
          <Button
            key={item.page}
            className="nav__item"
            align="start"
            variant={page === item.page ? "soft" : "ghost"}
            tone={page === item.page ? "primary" : "neutral"}
            size="sm"
            leadingIcon={<item.icon />}
            aria-current={page === item.page ? "page" : undefined}
            onClick={() => onNavigate(item.page)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <div className="sidebar__foot">
        <Avatar name="Mina Okafor" size="md" />
        <div className="sidebar__user">
          Mina Okafor
          <small>mina@acme.com</small>
        </div>
        <Menu>
          <Menu.Trigger asChild>
            <Button variant="ghost" size="sm" aria-label="Account menu" leadingIcon={<Icon.More />} />
          </Menu.Trigger>
          <Menu.Content align="end">
            <Menu.Label>Mina Okafor</Menu.Label>
            <Menu.Item>Profile</Menu.Item>
            <Menu.Item shortcut="⌘,">Preferences</Menu.Item>
            <Menu.Separator />
            <Menu.Item tone="danger">Sign out</Menu.Item>
          </Menu.Content>
        </Menu>
      </div>
    </>
  );
}
