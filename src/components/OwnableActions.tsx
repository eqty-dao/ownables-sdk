import { IconButton, Menu, MenuItem } from "@/components/ui";
import { EllipsisVertical as MoreVert } from "lucide-react";
import { useState, MouseEvent } from "react";
import PromptDialog from "./PromptDialog";
import { useAccount } from "wagmi";

interface OwnableActionsProps {
  className?: string;
  archived?: boolean;
  isTransferable: boolean;
  isHubAvailable?: boolean;
  isClosable: boolean;
  isClosed: boolean;
  isLockable: boolean;
  isLocked: boolean;
  onArchive?: () => void;
  onCloseOwnable?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
  onTransfer: (address: string) => void;
  onLock: () => void;
}

export default function OwnableActions(props: OwnableActionsProps) {
  const {
    archived = false,
    onArchive,
    onCloseOwnable,
    onRestore,
    onDelete,
    onTransfer,
    isTransferable,
    isHubAvailable = true,
    isClosable,
    isClosed,
    isLockable,
    isLocked,
    onLock,
  } =
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
      <IconButton
        aria-label="More options"
        className={props.className}
        onClick={open}
      >
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={close}
        onClick={close}
        className="min-w-40"
      >
        {!archived ? (
          <>
            <MenuItem
              disabled={!isTransferable || !isHubAvailable}
              onClick={() => { close(); setShowTransferDialog(true); }}
            >
              Transfer
            </MenuItem>
            {isLockable && !isLocked && (
              <MenuItem onClick={() => { close(); onLock(); }}>
                Lock
              </MenuItem>
            )}
            {isClosable && !isClosed && onCloseOwnable ? (
              <MenuItem onClick={() => { close(); onCloseOwnable(); }}>
                Close
              </MenuItem>
            ) : null}
            {onArchive ? (
              <MenuItem onClick={() => { close(); onArchive(); }}>
                Archive
              </MenuItem>
            ) : null}
          </>
        ) : (
          <>
            {onRestore ? (
              <MenuItem onClick={() => { close(); onRestore(); }}>
                Restore
              </MenuItem>
            ) : null}
            <MenuItem
              variant="danger"
              onClick={() => { close(); onDelete(); }}
            >
              Delete
            </MenuItem>
          </>
        )}
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
