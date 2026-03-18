import {
  Dialog,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Box,
} from "@/components/ui";
import bgImage from "../assets/login-bg.jpg";
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
      <Card style={cardStyle}>
        <CardMedia style={{ height: 200 }} src={bgImage} />
        <CardContent style={{ textAlign: "center" }}>
          <h1 style={{ marginTop: 6, marginBottom: 0 }}>Ownable SDK Wallet</h1>
        </CardContent>
        <CardActions style={{ paddingBottom: 14 }}>
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
