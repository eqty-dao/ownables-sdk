import {
  Dialog,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Grid,
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
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <WalletConnectControls />
              </Grid>
            </Grid>
          </Box>
        </CardActions>
      </Card>
    </Dialog>
  );
}
