import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Button,
  Badge,
  Skeleton,
} from "@/components/ui";
import { ArrowLeft as ArrowBack } from "lucide-react";
import { Drawer } from "@/components/ui";
import { EventChain } from "eqty-core";
import { enqueueSnackbar } from "notistack";
import placeholderImage from "../assets/cube.png";
import { useMessageCount } from "../hooks/useMessageCount";
import { useService } from "../hooks/useService";
import { useChainId } from "wagmi";

interface ViewMessagesBarProps {
  open: boolean;
  onClose: () => void;
  messagesCount: number;
  setOwnables: React.Dispatch<
    React.SetStateAction<
      Array<{ chain: EventChain; package: string; uniqueMessageHash?: string }>
    >
  >;
}

export const network = import.meta.env.VITE_LTO_NETWORK_ID;

const SkeletonMessageItem = () => (
  <ListItem
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      mb: 2,
      borderBottom: "1px solid #ddd",
      pb: 2,
    }}
  >
    <Box style={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
      <Skeleton
       
        width={35}
        height={35}
        style={{ borderRadius: "10%" }}
      />
      <Box style={{ flex: 1 }}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={14} />
      </Box>
    </Box>
    <Skeleton width="70%" height={14} className="mt-1" />
    <Skeleton
     
      width={80}
      height={28}
      style={{ marginTop: 4, borderRadius: 4 }}
    />
  </ListItem>
);

export const ViewMessagesBar: React.FC<ViewMessagesBarProps> = ({
  open,
  onClose,
  messagesCount,
  setOwnables,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [builderAddress, setBuilderAddress] = useState<string | null>(null);
  const [importedHashes, setImportedHashes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const { decrementMessageCount } = useMessageCount();

  const relayService = useService('relay');
  const packageService = useService('packages');
  const builderService = useService('builder');

  const fetchMessages = useCallback(async () => {
    if (!relayService || !await relayService.isAvailable()) return;

    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const relayData = await relayService.list(offset, itemsPerPage);

      if (relayData && Array.isArray(relayData.messages)) {
        setTotalCount(relayData.total);
        setMessages(relayData.messages);
      } else {
        setTotalCount(0);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      setTotalCount(0);
      setMessages([]);
    }
    setLoading(false);
  }, [currentPage, itemsPerPage, relayService]);

  const fetchImportedHashes = useCallback(async () => {
    try {
      const packages = packageService?.list() || [];
      const hashes = packages.map((msg: any) => msg.uniqueMessageHash);
      setImportedHashes(new Set(hashes));
    } catch (error) {
      console.error("Failed to fetch imported hashes:", error);
    }
  }, [packageService]);

  const handleImportMessage = async (hash: string) => {
    try {
      const { message } = await relayService?.readMessage(hash) ?? { };
      const importedPackage = message ? await packageService?.processPackage(message, hash, true) : null;

      if (importedPackage) {
        const chain = importedPackage.chain ? importedPackage.chain : null;

        if (chain) {
          setOwnables((prevOwnables) => [
            ...prevOwnables,
            {
              chain,
              package: importedPackage.cid,
              uniqueMessageHash: importedPackage.uniqueMessageHash,
            },
          ]);

          // Update imported hashes
          setImportedHashes((prev) => new Set(prev).add(hash));
          await decrementMessageCount();
          enqueueSnackbar(`Ownable imported successfully!`, { variant: "success" });
        } else {
          enqueueSnackbar(`Failed to parse import`, { variant: "error" });
        }
      } else {
        enqueueSnackbar(`Ownable already imported!`, { variant: "error" });
      }
    } catch (error) {
      console.error("Error importing message:", error);
      enqueueSnackbar(`Failed to import ownable`, { variant: "error" });
    }
  };

  const chainId = useChainId();
  const hasFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!builderService) {
      hasFetchedRef.current = null;
      return;
    }

    // Only fetch once per chainId, not on every builderService reference change
    if (hasFetchedRef.current === chainId.toString()) {
      return;
    }

    hasFetchedRef.current = chainId.toString();
    let cancelled = false;

    builderService.getAddress().then((serverAddress) => {
      if (!cancelled) {
        setBuilderAddress(serverAddress);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [builderService, chainId]); // Re-fetch only when chainId changes

  useEffect(() => {
    if (open) {
      fetchMessages().then();
      fetchImportedHashes().then();
    }
  }, [open, fetchMessages, fetchImportedHashes]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box style={{ width: 350, padding: 8 }}>
        <Box className="flex items-center justify-between">
          <span>
            Messages
          </span>
          <IconButton onClick={onClose}>
            <ArrowBack />
          </IconButton>
        </Box>

        <Box className="mt-2">
          <span>
            {messagesCount > 0
              ? `You have ${messagesCount} unread messages.`
              : "No new messages"}
          </span>
        </Box>

        {loading ? (
          <List>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonMessageItem key={i} />
            ))}
          </List>
        ) : (
          <List>
            {messages.map((msg, index) =>
              msg.version === 0 ? (
                <ListItem
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    marginBottom: 8,
                    borderBottom: "1px solid #ddd",
                    paddingBottom: 8,
                  }}
                >
                  <Box
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 8,
                    }}
                  >
                    {" "}
                    <Box
                      style={{
                        width: 35,
                        height: 35,
                        borderRadius: "10%",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={placeholderImage}
                        alt="Thumbnail"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={
                        <span
                         
                          style={{ fontSize: "0.6rem", fontWeight: "bold" }}
                        >
                          Sender:{" "}
                          {msg?.sender === builderAddress
                            ? "Obuilder"
                            : msg?.sender || "Unknown"}
                        </span>
                      }
                      secondary={
                        <span
                         
                          style={{ fontSize: "0.6rem", color: "text.secondary" }}
                        >
                          Size: {(msg?.size / 1024 / 1024 || 0).toFixed(2)} MB
                        </span>
                      }
                    />
                  </Box>
                  <span className="mt-0.5 text-[0.55rem]">
                    <span style={{ fontWeight: 800 }}> Date:</span>{" "}
                    {new Date(msg?.timestamp || 0).toLocaleString()}
                  </span>
                  <Box className="mt-1 flex items-center">
                    <Button
                     
                      size="small"
                      style={{
                        fontSize: "0.625rem",
                        padding: "3px 6px",
                        minWidth: "unset",
                        lineHeight: 1.3,
                      }}
                      onClick={() => handleImportMessage(msg?.hash)}
                    >
                      Import Message
                    </Button>
                    {!importedHashes.has(msg?.hash) && (
                      <Badge variant="dot" style={{ marginLeft: 8 }} />
                    )}
                  </Box>
                </ListItem>
              ) : (
                //version 2 message support
                <ListItem
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    marginBottom: 8,
                    borderBottom: "1px solid #ddd",
                    paddingBottom: 8,
                  }}
                >
                  <Box
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      gap: 8,
                    }}
                  >
                    {(msg?.meta?.thumbnail && (
                      <Box
                        style={{
                          width: 35,
                          height: 35,
                          borderRadius: "10%",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={msg.meta.thumbnail}
                          alt="Thumbnail"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )) || (
                      <Box
                        style={{
                          width: 35,
                          height: 35,
                          borderRadius: "10%",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={placeholderImage}
                          alt="Thumbnail"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )}

                    <Box>
                      <span
                       
                        style={{ fontSize: "0.7rem", fontWeight: "bold" }}
                      >
                        {msg?.meta?.title
                          ? msg.meta.title.length > 16
                            ? msg.meta.title.slice(0, 16) + "..."
                            : msg.meta.title
                          : "Unknown"}
                      </span>
                      <span
                       
                        style={{ fontSize: "0.6rem", fontWeight: "bold" }}
                      >
                        Sender:{" "}
                        {msg?.sender === builderAddress
                          ? "Obuilder"
                          : msg?.sender || "Unknown"}
                      </span>
                      <span
                       
                        style={{ fontSize: "0.6rem", color: "text.secondary" }}
                      >
                        Size: {(msg?.size / 1024 / 1024 || 0).toFixed(2)} MB
                      </span>
                    </Box>
                  </Box>

                  <span className="mt-0.5 text-[0.55rem]">
                    <span style={{ fontWeight: 800 }}> Date:</span>{" "}
                    {new Date(msg?.timestamp || 0).toLocaleString()}
                  </span>

                  <Box className="mt-1 flex items-center">
                    <Button
                     
                      size="small"
                      style={{
                        fontSize: "0.625rem",
                        padding: "3px 6px",
                        minWidth: "unset",
                        lineHeight: 1.3,
                      }}
                      onClick={() => handleImportMessage(msg?.hash)}
                    >
                      Import Message
                    </Button>
                    {!importedHashes.has(msg?.hash) && (
                      <Badge variant="dot" style={{ marginLeft: 8 }} />
                    )}
                  </Box>
                </ListItem>
              )
            )}
          </List>
        )}
        {messages.length > 0 && (
          <Box className="mt-2 flex items-center justify-between">
            <Button
             
              size="small"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span>
              Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)}
            </span>
            <Button
             
              size="small"
              onClick={() =>
                setCurrentPage((prev) =>
                  prev < Math.ceil(totalCount / itemsPerPage) ? prev + 1 : prev
                )
              }
              disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
            >
              Next
            </Button>
          </Box>
        )}
        <Box className="mt-1 flex justify-center">
          <Button
           
            size="small"
            onClick={() => {
              setItemsPerPage((prev) => (prev === 50 ? 100 : 50));
              setCurrentPage(1);
            }}
          >
            {itemsPerPage === 50 ? "Show 100 per page" : "Show 50 per page"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
