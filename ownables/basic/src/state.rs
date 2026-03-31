use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use cw_storage_plus::Item;
use ownable_std::{Metadata, NFT, OwnableInfo};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {}

pub const CONFIG: Item<Config> = Item::new("config");
pub const OWNABLE_INFO: Item<OwnableInfo> = Item::new("ownable_info");
pub const METADATA: Item<Metadata> = Item::new("metadata");
pub const NFT_ITEM: Item<NFT> = Item::new("nft");
pub const PACKAGE_CID: Item<String> = Item::new("package_cid");
pub const NETWORK_ID: Item<u32> = Item::new("network_id");
