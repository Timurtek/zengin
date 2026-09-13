import { Button, Card, Dialog, Select, Separator, Switch, TextArea, TextField, toast } from "@zenginui/ui";
import { useState } from "react";

export function Settings() {
  const [name, setName] = useState("Acme");
  const [description, setDescription] = useState("Field service scheduling for mid-size fleets.");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [twoFactor, setTwoFactor] = useState(true);
  const [digest, setDigest] = useState(false);

  return (
    <div className="settings">
      <Card padding="lg">
        <div className="form">
        <div className="panel__head">
          <div>
            <h2>Organization</h2>
            <p>What customers and teammates see.</p>
          </div>
        </div>
        <div className="form__row">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select label="Timezone" value={timezone} onValueChange={setTimezone} description="For invoices and digests.">
            <Select.Item value="Europe/Berlin">Europe, Berlin</Select.Item>
            <Select.Item value="Europe/London">Europe, London</Select.Item>
            <Select.Item value="America/New_York">America, New York</Select.Item>
            <Select.Item value="America/Los_Angeles">America, Los Angeles</Select.Item>
            <Select.Item value="Asia/Tokyo">Asia, Tokyo</Select.Item>
          </Select>
        </div>
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} description="Shown on your public status page." />
        <Separator />
        <div className="switches">
          <Switch label="Require two-factor authentication" description="Every member must enroll before their next sign-in." checked={twoFactor} onCheckedChange={setTwoFactor} />
          <Switch label="Weekly digest" description="A summary of signups, revenue and churn every Monday." checked={digest} onCheckedChange={setDigest} />
        </div>
        <div className="form__actions">
          <Button variant="ghost" onClick={() => toast({ title: "Changes discarded" })}>
            Discard
          </Button>
          <Button tone="primary" onClick={() => toast({ title: "Settings saved", description: `${name} updated.`, tone: "success" })}>
            Save changes
          </Button>
        </div>
        </div>
      </Card>

      <Card padding="lg" variant="outlined">
        <div className="danger">
        <div>
          <h2 className="section-title">Delete organization</h2>
          <p>Removes every customer, invoice and member. There is no undo.</p>
        </div>
        <Dialog size="sm">
          <Dialog.Trigger asChild>
            <Button tone="danger" variant="soft">
              Delete organization
            </Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Delete {name}?</Dialog.Title>
            <Dialog.Description>Type the organization name to confirm. Everything is removed immediately.</Dialog.Description>
            <TextField label="Organization name" placeholder={name} />
            <Dialog.Footer>
              <Dialog.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Button tone="danger" onClick={() => toast({ title: "Not really deleted", description: "This is the demo.", tone: "warning" })}>
                  Delete
                </Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        </div>
      </Card>
    </div>
  );
}
