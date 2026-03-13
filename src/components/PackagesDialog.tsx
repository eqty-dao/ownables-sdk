import { TypedPackage, TypedPackageStub } from "../interfaces/TypedPackage";
import ListItem from "@ui/mui/ListItem";
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Skeleton,
  Typography,
} from "@ui/mui";
import Dialog from "@ui/mui/Dialog";
import CloseIcon from "@ui/icons/Close";
import List from "@ui/mui/List";
import Tooltip from "./Tooltip";
import ListItemButton from "@ui/mui/ListItemButton";
import ListItemText from "@ui/mui/ListItemText";
import If from "./If";
import AutoAwesomeIcon from "@ui/icons/AutoAwesome";
import DriveFolderUploadIcon from "@ui/icons/DriveFolderUpload";
import { useService } from "../hooks/useService";

function SkeletonPackageItem() {
  return (
    <ListItem
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        mb: 2,
        borderBottom: "1px solid #ddd",
        pb: 2,
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
      >
        <Skeleton
          variant="rectangular"
          width={35}
          height={35}
          sx={{ borderRadius: "10%" }}
        />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="80%" height={16} />
          <Skeleton variant="text" width="60%" height={14} />
        </Box>
      </Box>
    </ListItem>
  );
}

interface PackagesDialogProps {
  packages: Array<TypedPackage | TypedPackageStub>;
  open: boolean;
  onClose: () => void;
  onSelect: (pkg: TypedPackage | TypedPackageStub) => void;
  onImport: () => void;
  fetchPkgFromRelay: () => void;
  onCreate: () => void;
  message: number;
  isLoading: boolean;
}

export function PackagesDialog(props: PackagesDialogProps) {
  const { onClose, onSelect, onImport, onCreate, open, isLoading } = props;
  const filteredPackages = props.packages.filter((pkg) => !pkg.isNotLocal);
  const builderService = useService("builder");
  const hasBuilder = !!builderService;

  return (
    <Dialog onClose={onClose} open={open} maxWidth="sm" fullWidth>
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Packages
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ pt: 2 }} disablePadding>
          {isLoading ? (
            <>
              <SkeletonPackageItem />
              <SkeletonPackageItem />
              <SkeletonPackageItem />
            </>
          ) : (
            filteredPackages.map((pkg) => (
              <ListItem disablePadding disableGutters key={pkg.title}>
                <Tooltip
                  condition={"stub" in pkg}
                  title={`Import ${pkg.title} example`}
                  placement="right"
                  arrow
                >
                  <ListItemButton
                    onClick={() => onSelect(pkg)}
                    style={{
                      textAlign: "center",
                      color: "stub" in pkg ? "#666" : undefined,
                    }}
                  >
                    <ListItemText
                      primary={pkg.title}
                      secondary={pkg.description}
                      secondaryTypographyProps={{
                        color:
                          "stub" in pkg
                            ? "rgba(0, 0, 0, 0.3)"
                            : "rgba(0, 0, 0, 0.6)",
                        fontSize: "0.75em",
                      }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))
          )}
        </List>
        <If condition={props.packages.length > 0}>
          <Divider />
        </If>
        <List sx={{ pt: 0 }} disablePadding>
          <ListItem disablePadding disableGutters key="create-ownable">
            <ListItemButton
              autoFocus
              onClick={onCreate}
              style={{ textAlign: "center" }}
              disabled={!hasBuilder}
            >
              <ListItemIcon>
                <AutoAwesomeIcon />
              </ListItemIcon>
              <ListItemText primary="Create ownable" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding disableGutters key="add-local">
            <ListItemButton
              autoFocus
              onClick={onImport}
              style={{ textAlign: "center" }}
            >
              <ListItemIcon>
                <DriveFolderUploadIcon />
              </ListItemIcon>
              <ListItemText primary="Import package" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Dialog>
  );
}
