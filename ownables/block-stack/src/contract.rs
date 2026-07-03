use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{CONFIG, Config, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID};
use alloy_sol_types::sol;
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_json_binary};
use cw2::set_contract_version;
use ownable_std::abi::cbor_from_slice;
use ownable_std::{
    EncodePublicEventRequest, InfoResponse, Metadata, OwnableEvent, OwnableInfo, PublicEvent,
    decode_abi_for, encode_abi, package_title_from_name,
};

const CONTRACT_NAME: &str = concat!("crates.io:", env!("CARGO_PKG_NAME"));
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
const STACK_EVENT_TYPE: &str = "stack";
const RESET_EVENT_TYPE: &str = "reset";
const TOTAL_BLOCKS: u8 = 7;

sol! {
    struct BlockCountEvent {
        uint8 totalBlocks;
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
struct BlockCountPayload {
    total_blocks: u8,
}

pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let ownable_info = OwnableInfo {
        owner: info.sender.clone(),
        issuer: info.sender.clone(),
        ownable_type: Some("block_stack".to_string()),
    };

    let metadata = Metadata {
        image: None,
        image_data: None,
        external_url: None,
        description: Some(env!("CARGO_PKG_DESCRIPTION").to_string()),
        name: Some(package_title_from_name(env!("CARGO_PKG_NAME"))),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    NETWORK_ID.save(deps.storage, &msg.network_id)?;
    CONFIG.save(
        deps.storage,
        &Config {
            stacked_blocks: 1,
        },
    )?;
    if let Some(nft) = msg.nft {
        NFT_ITEM.save(deps.storage, &nft)?;
    }
    METADATA.save(deps.storage, &metadata)?;
    OWNABLE_INFO.save(deps.storage, &ownable_info)?;
    PACKAGE_CID.save(deps.storage, &msg.package)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", ownable_info.owner)
        .add_attribute("issuer", ownable_info.issuer)
        .add_attribute("stacked_blocks", "1"))
}

pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
    }
}

pub fn register(
    _info: MessageInfo,
    deps: DepsMut,
    event: PublicEvent,
) -> Result<Response, ContractError> {
    let owner = OWNABLE_INFO.load(deps.storage)?.owner;
    if event.source.to_lowercase() != owner.to_string().to_lowercase() {
        return Err(ContractError::Unauthorized {
            val: "Only the owner may rearrange the public blocks".into(),
        });
    }

    match event.event_type.as_str() {
        STACK_EVENT_TYPE => {
            let decoded = decode_abi_for::<BlockCountEvent>(&event, STACK_EVENT_TYPE)
                .map_err(|_| ContractError::InvalidExternalEventArgs {})?;
            apply_stack(deps, decoded.totalBlocks)
        }
        RESET_EVENT_TYPE => {
            let decoded = decode_abi_for::<BlockCountEvent>(&event, RESET_EVENT_TYPE)
                .map_err(|_| ContractError::InvalidExternalEventArgs {})?;
            apply_reset(deps, decoded.totalBlocks)
        }
        _ => Err(ContractError::MatchEventError {
            val: event.event_type,
        }),
    }
}

pub fn ingest(
    info: MessageInfo,
    deps: DepsMut,
    event: OwnableEvent,
) -> Result<Response, ContractError> {
    let _ = (info, deps);
    Err(ContractError::MatchEventError {
        val: event.event_type,
    })
}

pub fn encode_public_event(request: EncodePublicEventRequest) -> Result<Vec<u8>, ContractError> {
    let payload: BlockCountPayload = cbor_from_slice(request.data.as_slice())
        .map_err(|_| ContractError::InvalidExternalEventArgs {})?;

    match request.event_type.as_str() {
        STACK_EVENT_TYPE => Ok(encode_abi::<BlockCountEvent>(&BlockCountEvent {
            totalBlocks: payload.total_blocks,
        })),
        RESET_EVENT_TYPE => Ok(encode_abi::<BlockCountEvent>(&BlockCountEvent {
            totalBlocks: payload.total_blocks,
        })),
        _ => Err(ContractError::MatchEventError {
            val: request.event_type,
        }),
    }
}

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetInfo {} => query_ownable_info(deps),
        QueryMsg::GetMetadata {} => query_ownable_metadata(deps),
        QueryMsg::GetWidgetState {} => query_ownable_widget_state(deps),
    }
}

fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let ownership = OWNABLE_INFO.update(deps.storage, |mut config| -> Result<_, ContractError> {
        let address = info.sender.clone();
        if address != config.owner {
            return Err(ContractError::Unauthorized {
                val: "Unauthorized transfer attempt".to_string(),
            });
        }
        if address == to {
            return Err(ContractError::CustomError {
                val: "Unable to transfer: Recipient address is current owner".to_string(),
            });
        }
        config.owner = to.clone();
        Ok(config)
    })?;

    Ok(Response::new()
        .add_attribute("method", "try_transfer")
        .add_attribute("new_owner", ownership.owner))
}

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_state = CONFIG.load(deps.storage)?;
    to_json_binary(&widget_state)
}

fn query_ownable_info(deps: Deps) -> StdResult<Binary> {
    let nft = NFT_ITEM.may_load(deps.storage)?;
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;
    to_json_binary(&InfoResponse {
        owner: ownable_info.owner,
        issuer: ownable_info.issuer,
        nft,
        ownable_type: ownable_info.ownable_type,
    })
}

fn query_ownable_metadata(deps: Deps) -> StdResult<Binary> {
    let metadata = METADATA.load(deps.storage)?;
    to_json_binary(&metadata)
}

fn apply_stack(deps: DepsMut, total_blocks: u8) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if total_blocks > TOTAL_BLOCKS || total_blocks != config.stacked_blocks.saturating_add(1) {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    config.stacked_blocks = total_blocks;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "apply_stack")
        .add_attribute("stacked_blocks", total_blocks.to_string()))
}

fn apply_reset(deps: DepsMut, total_blocks: u8) -> Result<Response, ContractError> {
    if total_blocks != 1 {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let mut config = CONFIG.load(deps.storage)?;
    config.stacked_blocks = 1;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "apply_reset")
        .add_attribute("stacked_blocks", "1"))
}
