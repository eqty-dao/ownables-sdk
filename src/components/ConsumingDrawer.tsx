import { Box, Button } from "@/components/ui";
import HelpDrawer from "./HelpDrawer";

interface ConsumingDrawerProps {
  open: boolean;
  packageTitle: string;
  onCancel: () => void;
}

export default function ConsumingDrawer({ open, packageTitle, onCancel }: ConsumingDrawerProps) {
  return (
    <HelpDrawer open={open}>
      <p className="font-bold">
        Select which Ownable should consume this <em>{packageTitle}</em>
      </p>
      <Box>
        <Button className="text-white" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </HelpDrawer>
  );
}
