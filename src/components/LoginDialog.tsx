import {
  Dialog,
  Card,
  CardActions,
  CardContent,
  Box,
} from "@/components/ui";
import WalletConnectControls from './WalletConnectControls';

const cardStyle = {
  width: 500,
  maxWidth: "calc(100vw - 64px)",
};

interface LoginDialogProps {
  open: boolean;
}

export default function LoginDialog(props: LoginDialogProps) {
  const { open } = props;

  return (
    <Dialog open={open}>
      <Card style={cardStyle} className="rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <CardContent style={{ textAlign: "center" }} className="pb-2 pt-6">
          <h1 className="text-section-title mb-0 mt-1">Ownable SDK Wallet</h1>
        </CardContent>
        <CardActions style={{ paddingBottom: 14 }} className="px-6 pb-6">
          <Box className="grow">
            <div className="flex flex-col gap-2">
              <WalletConnectControls />
            </div>
          </Box>
        </CardActions>
      </Card>
    </Dialog>
  );
}
