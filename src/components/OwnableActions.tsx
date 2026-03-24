import { IconButton, ListItemIcon, Menu, MenuItem } from "@/components/ui";
import { EllipsisVertical as MoreVert, Trash2 as Delete, Wrench as PrecisionManufacturing, ArrowLeftRight as SwapHoriz } from "lucide-react";
import { useState, MouseEvent } from "react";
import PromptDialog from "./PromptDialog";
import { useAccount } from "wagmi";

interface OwnableActionsProps {
  className?: string;
  title: string;
  isConsumable: boolean;
  isTransferable: boolean;
  chain: any;
  onDelete: () => void;
  onConsume: () => void;
  onTransfer: (address: string) => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const { onDelete, onConsume, onTransfer, isConsumable, isTransferable } =
    props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const { address } = useAccount();

  const open = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const close = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton className={props.className} onClick={open}>
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        onClick={close}
        className="min-w-40"
      >
        <MenuItem
          disabled={!isConsumable}
          onClick={() => {
            close();
            onConsume();
          }}
        >
          Consume
        </MenuItem>
        <MenuItem
          disabled={!isTransferable}
          onClick={() => {
            close();
            setShowTransferDialog(true);
          }}
        >
          Transfer
        </MenuItem>
        <MenuItem
          variant="danger"
          onClick={() => {
            close();
            onDelete();
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <PromptDialog
        title="Transfer Ownable"
        open={showTransferDialog}
        onClose={() => setShowTransferDialog(false)}
        onSubmit={onTransfer}
        validate={(recipient) => {
          if (address === recipient) return "Can't transfer to own account";

          // Basic Ethereum address validation
          if (!recipient || recipient.length !== 42) {
            return "Invalid Ethereum address length";
          }

          if (!recipient.startsWith("0x")) {
            return "Ethereum address must start with 0x";
          }

          // Check if it's a valid hex string
          const hexPattern = /^0x[a-fA-F0-9]{40}$/;
          if (!hexPattern.test(recipient)) {
            return "Invalid Ethereum address format";
          }

          return "";
        }}
        TextFieldProps={{
          label: "Recipient address",
          className: "w-[380px] max-w-full",
        }}
        actionType="transfer"
      />
    </>
  );
}
