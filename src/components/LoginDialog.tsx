import {
  Dialog,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Box,
  DialogHeader,
} from "@/components/ui";
import WalletConnectControls from './WalletConnectControls';
import loginBg from '@/assets/login-bg.jpg';

interface LoginDialogProps {
  open: boolean;
}

export default function LoginDialog(props: LoginDialogProps) {
  const { open } = props;

  return (
    <Dialog open={open} className="max-w-125 border-none">
      <Card className="w-full">
        <CardMedia src={loginBg} className="max-h-60 w-full" style={{ objectFit: 'cover', objectPosition: 'center' }} />
        <CardContent style={{ textAlign: "center" }} className="pb-2 pt-6">
          <h1 className="text-section-title mb-2 mt-1 text-2xl md:text-3xl">Ownables SDK Wallet</h1>
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
