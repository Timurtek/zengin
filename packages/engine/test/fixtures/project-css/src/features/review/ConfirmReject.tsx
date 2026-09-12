import { Dialog } from "@headlessui/react";
import "./confirm-reject.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConfirmReject({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="confirm-reject">
      <Dialog.Panel className="confirm-reject__panel">
        <Dialog.Title className="confirm-reject__title">Reject this item?</Dialog.Title>
        <button type="button" onClick={onClose} className="confirm-reject__cancel">
          Cancel
        </button>
      </Dialog.Panel>
    </Dialog>
  );
}
