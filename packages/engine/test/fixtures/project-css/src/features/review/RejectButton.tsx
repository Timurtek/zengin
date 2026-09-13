import { Button } from "@zenginui/ui";
import "./reject-button.css";

export function RejectButton() {
  return (
    <>
      <Button variant="ghost-danger" size="xl" className="reject-button" style={{ borderRadius: 0 }}>
        Reject
      </Button>
      <Button varient="link" className="reject-button__undo">
        Undo
      </Button>
    </>
  );
}
