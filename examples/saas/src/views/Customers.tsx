import { Avatar, Badge, Button, Card, Menu, Progress, Select, Sheet, Sparkline, Table, TextField, toast, Icon } from "@zengin/ui";
import { useMemo, useState } from "react";
import { customers, money, PLANS, type Customer, type CustomerStatus } from "../data";

const STATUS_TONE: Record<CustomerStatus, "success" | "primary" | "warning" | "neutral"> = { active: "success", trial: "primary", "past-due": "warning", churned: "neutral" };
const PAGE_SIZE = 10;

export function Customers() {
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Customer | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => (plan === "all" || c.plan === plan) && (status === "all" || c.status === status) && (!q || `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q)));
  }, [query, plan, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="toolbar">
        <TextField className="toolbar__search" size="sm" label="Search" placeholder="Name, company or email" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        <Select className="toolbar__filter" size="sm" label="Plan" value={plan} onValueChange={(v) => { setPlan(v); setPage(0); }}>
          <Select.Item value="all">All plans</Select.Item>
          {PLANS.map((p) => (
            <Select.Item key={p} value={p}>
              {p}
            </Select.Item>
          ))}
        </Select>
        <Select className="toolbar__filter" size="sm" label="Status" value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <Select.Item value="all">All statuses</Select.Item>
          <Select.Item value="active">Active</Select.Item>
          <Select.Item value="trial">Trial</Select.Item>
          <Select.Item value="past-due">Past due</Select.Item>
          <Select.Item value="churned">Churned</Select.Item>
        </Select>
        <span className="toolbar__spacer" />
        <Button tone="primary" size="sm" leadingIcon={<Icon.Plus />} onClick={() => toast({ title: "Invite sent", description: "The customer gets an email with a sign-in link.", tone: "success" })}>
          New customer
        </Button>
      </div>

      <Card padding="none">
        <Table aria-label="Customers">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Customer</Table.HeadCell>
              <Table.HeadCell>Plan</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell align="end" numeric>
                MRR
              </Table.HeadCell>
              <Table.HeadCell align="end" numeric>
                Seats
              </Table.HeadCell>
              <Table.HeadCell>Usage, 12 weeks</Table.HeadCell>
              <Table.HeadCell align="end">
                <span className="z-sr-only">Actions</span>
              </Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {visible.map((c) => (
              <Table.Row key={c.id} interactive selected={selected?.id === c.id} onClick={() => setSelected(c)}>
                <Table.Cell>
                  <div className="who">
                    <Avatar name={c.name} size="sm" />
                    <div className="who__text">
                      {c.name}
                      <small>
                        {c.company} · {c.email}
                      </small>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>{c.plan}</Table.Cell>
                <Table.Cell>
                  <Badge tone={STATUS_TONE[c.status]} size="sm">
                    {c.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell align="end" numeric>
                  {money(c.mrr)}
                </Table.Cell>
                <Table.Cell align="end" numeric>
                  {c.seats}
                </Table.Cell>
                <Table.Cell>
                  <div className="cell-spark">
                    <Sparkline values={c.usage} tone={c.status === "churned" ? "neutral" : "primary"} height={24} aria-label={`${c.name} usage, 12 weeks`} />
                  </div>
                </Table.Cell>
                <Table.Cell align="end">
                  <Menu>
                    <Menu.Trigger asChild>
                      <Button variant="ghost" size="sm" aria-label={`Actions for ${c.name}`} leadingIcon={<Icon.More />} onClick={(e) => e.stopPropagation()} />
                    </Menu.Trigger>
                    <Menu.Content align="end" onClick={(e) => e.stopPropagation()}>
                      <Menu.Item onSelect={() => setSelected(c)}>View</Menu.Item>
                      <Menu.Item onSelect={() => toast({ title: `Editing ${c.name}` })}>Edit</Menu.Item>
                      <Menu.Separator />
                      <Menu.Item tone="danger" onSelect={() => toast({ title: `${c.company} suspended`, tone: "danger", action: { label: "Undo", onClick: () => toast({ title: "Restored", tone: "success" }) } })}>
                        Suspend
                      </Menu.Item>
                    </Menu.Content>
                  </Menu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>

      <div className="pager">
        <span>
          {rows.length} customer{rows.length === 1 ? "" : "s"}, page {current + 1} of {pages}
        </span>
        <div className="pager__buttons">
          <Button variant="soft" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button variant="soft" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} side="right" size="md">
        <Sheet.Content>
          {selected && (
            <div className="detail">
              <Sheet.Title>{selected.company}</Sheet.Title>
              <Sheet.Description>
                {selected.name} · {selected.email}
              </Sheet.Description>
              <dl className="detail__grid">
                <div>
                  <dt>Plan</dt>
                  <dd>{selected.plan}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <Badge tone={STATUS_TONE[selected.status]} size="sm">
                      {selected.status}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>MRR</dt>
                  <dd>{money(selected.mrr)}</dd>
                </div>
                <div>
                  <dt>Customer since</dt>
                  <dd>{selected.joined}</dd>
                </div>
              </dl>
              <Progress label="Seats in use" value={Math.min(selected.seats, Math.round(selected.seats * 0.8))} max={selected.seats} showValue tone={selected.status === "past-due" ? "warning" : "primary"} />
              <Sparkline values={selected.usage} height={48} aria-label="Usage, 12 weeks" />
              <Sheet.Footer>
                <Sheet.Close asChild>
                  <Button variant="ghost">Close</Button>
                </Sheet.Close>
                <Button tone="primary" onClick={() => toast({ title: "Note added", tone: "success" })}>
                  Add note
                </Button>
              </Sheet.Footer>
            </div>
          )}
        </Sheet.Content>
      </Sheet>
    </>
  );
}
