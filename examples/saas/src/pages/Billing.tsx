import { Badge, Button, Card, Dialog, Progress, Select, Separator, Switch, Table, toast } from "@zengin/ui";
import { useState } from "react";
import { Icon } from "../icons";
import { invoices, money, quotas } from "../data";

const INVOICE_TONE = { paid: "success", open: "primary", failed: "danger" } as const;

export function Billing() {
  const [plan, setPlan] = useState("business");
  const [autoRenew, setAutoRenew] = useState(true);
  const [emailInvoices, setEmailInvoices] = useState(true);

  return (
    <div className="billing">
      <div className="panel">
        <Card padding="lg">
          <div className="plan">
          <div className="panel__head">
            <h2>Current plan</h2>
            <Badge tone="primary">Business</Badge>
          </div>
          <div className="plan__price">
            {money(349)} <small>per month, billed monthly</small>
          </div>
          <p className="muted">50 seats, 2.5M API calls, 500 GB storage, priority support. Next invoice on Oct 1, 2026.</p>
          <div className="form__actions">
            <Dialog size="sm">
              <Dialog.Trigger asChild>
                <Button variant="soft">Change plan</Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Title>Change plan</Dialog.Title>
                <Dialog.Description>Changes apply at the next billing date. Downgrades keep your data.</Dialog.Description>
                <Select label="Plan" value={plan} onValueChange={setPlan}>
                  <Select.Item value="starter">Starter, $29</Select.Item>
                  <Select.Item value="team">Team, $99</Select.Item>
                  <Select.Item value="business">Business, $349</Select.Item>
                  <Select.Item value="enterprise">Enterprise, custom</Select.Item>
                </Select>
                <Dialog.Footer>
                  <Dialog.Close asChild>
                    <Button variant="ghost">Cancel</Button>
                  </Dialog.Close>
                  <Dialog.Close asChild>
                    <Button tone="primary" onClick={() => toast({ title: "Plan change scheduled", description: "Takes effect on Oct 1, 2026.", tone: "success" })}>
                      Confirm
                    </Button>
                  </Dialog.Close>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog>
          </div>
          <Separator />
          <div className="switches">
            <Switch label="Auto-renew" description="Renew the subscription at each period end." checked={autoRenew} onCheckedChange={setAutoRenew} />
            <Switch label="Email invoices" description="Send each invoice to billing@acme.com." checked={emailInvoices} onCheckedChange={setEmailInvoices} />
          </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="quotas">
          <div className="panel__head">
            <h2>Usage this period</h2>
            <p>Resets Oct 1.</p>
          </div>
          {quotas.map((q) => {
            const ratio = q.used / q.limit;
            return (
              <Progress
                key={q.name}
                label={`${q.name}: ${q.used.toLocaleString("en-US")}${q.unit ? ` ${q.unit}` : ""} of ${q.limit.toLocaleString("en-US")}${q.unit ? ` ${q.unit}` : ""}`}
                value={q.used}
                max={q.limit}
                showValue
                tone={ratio > 0.9 ? "danger" : ratio > 0.75 ? "warning" : "primary"}
              />
            );
          })}
          </div>
        </Card>
      </div>

      <Card padding="none">
        <Table aria-label="Invoices">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Invoice</Table.HeadCell>
              <Table.HeadCell>Date</Table.HeadCell>
              <Table.HeadCell align="end" numeric>
                Amount
              </Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell align="end">
                <span className="z-sr-only">Download</span>
              </Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {invoices.map((inv) => (
              <Table.Row key={inv.id}>
                <Table.Cell>{inv.id}</Table.Cell>
                <Table.Cell className="muted">{inv.date}</Table.Cell>
                <Table.Cell align="end" numeric>
                  {money(inv.amount)}
                </Table.Cell>
                <Table.Cell>
                  <Badge tone={INVOICE_TONE[inv.status]} size="sm">
                    {inv.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell align="end">
                  <Button variant="ghost" size="sm" leadingIcon={<Icon.Download />} aria-label={`Download ${inv.id}`} onClick={() => toast({ title: `${inv.id}.pdf`, description: "Downloading." })} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
}
