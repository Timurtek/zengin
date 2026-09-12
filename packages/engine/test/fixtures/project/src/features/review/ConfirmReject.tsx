import { Dialog } from "@headlessui/react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConfirmReject({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="fixed inset-0 grid place-items-center">
      <Dialog.Panel className="rounded-lg bg-surface p-6 shadow-lg">
        <Dialog.Title className="text-lg font-semibold">Reject this item?</Dialog.Title>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-on-primary"
        >
          Cancel
        </button>
      </Dialog.Panel>
    </Dialog>
  );
}
