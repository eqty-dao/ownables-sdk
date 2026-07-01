use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{
    CONFIG, Config, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID,
};
use alloy_sol_types::sol;
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_json_binary};
use cw2::set_contract_version;
use ownable_std::abi::cbor_from_slice;
use ownable_std::{
    EncodePublicEventRequest, InfoResponse, Metadata, OwnableEvent, OwnableInfo, PublicEvent,
    decode_abi_for, encode_abi, ensure_owner, get_random_color, package_title_from_name,
};

// version info for migration info
const CONTRACT_NAME: &str = concat!("crates.io:", env!("CARGO_PKG_NAME"));
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
const DRINK_EVENT_TYPE: &str = "drink";

sol! {
    struct DrinkEvent {
        uint8 amount;
    }
}

#[derive(serde::Deserialize)]
struct DrinkPayload {
    amount: u8,
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
        ownable_type: Some("potion".to_string()),
    };

    let config = Config {
        max_capacity: 100,
        current_amount: 100,
        color: get_random_color(msg.clone().ownable_id),
    };

    let package_title = package_title_from_name(env!("CARGO_PKG_NAME"));
    let meta = Metadata {
        image: None,
        image_data: None,
        external_url: None,
        description: Some(env!("CARGO_PKG_DESCRIPTION").to_string()),
        name: Some(package_title.clone()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };

    NETWORK_ID.save(deps.storage, &msg.network_id)?;
    CONFIG.save(deps.storage, &config.clone())?;
    if let Some(nft) = msg.nft {
        NFT_ITEM.save(deps.storage, &nft)?;
    }
    METADATA.save(deps.storage, &meta)?;
    OWNABLE_INFO.save(deps.storage, &ownable_info)?;
    PACKAGE_CID.save(deps.storage, &msg.package)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", ownable_info.owner.clone())
        .add_attribute("issuer", ownable_info.issuer.clone())
        .add_attribute("color", config.color)
        .add_attribute("current_amount", config.max_capacity.to_string()))
}

pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
        ExecuteMsg::Drink { amount } => try_drink(info, deps, amount),
    }
}

pub fn register(
    info: MessageInfo,
    deps: DepsMut,
    event: PublicEvent,
) -> Result<Response, ContractError> {
    match event.event_type.as_str() {
        DRINK_EVENT_TYPE => try_register_drink(info, deps, event),
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
    match request.event_type.as_str() {
        DRINK_EVENT_TYPE => {
            let payload: DrinkPayload = cbor_from_slice(request.data.as_slice())
                .map_err(|_| ContractError::InvalidExternalEventArgs {})?;
            Ok(encode_abi::<DrinkEvent>(&DrinkEvent {
                amount: payload.amount,
            }))
        }
        _ => Err(ContractError::MatchEventError {
            val: request.event_type,
        }),
    }
}

fn try_register_drink(
    _info: MessageInfo,
    deps: DepsMut,
    event: PublicEvent,
) -> Result<Response, ContractError> {
    let owner = OWNABLE_INFO.load(deps.storage)?.owner;
    if event.source.to_lowercase() != owner.to_string().to_lowercase() {
        return Err(ContractError::Unauthorized {
            val: "Unable to drink potion".into(),
        });
    }

    let decoded = decode_abi_for::<DrinkEvent>(&event, DRINK_EVENT_TYPE)
        .map_err(|_| ContractError::InvalidExternalEventArgs {})?;
    apply_drink(deps, decoded.amount)
}


pub fn try_drink(
    info: MessageInfo,
    deps: DepsMut,
    consumption_amount: u8,
) -> Result<Response, ContractError> {
    let ownership = OWNABLE_INFO.load(deps.storage)?;
    ensure_owner(&ownership, &info.sender, || ContractError::Unauthorized {
        val: "Unable to drink potion".into(),
    })?;
    apply_drink(deps, consumption_amount)
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let ownership =
        OWNABLE_INFO.update(deps.storage, |mut config| -> Result<_, ContractError> {
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
        .add_attribute("new_owner", ownership.owner.to_string()))
}

pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetInfo {} => query_ownable_info(deps),
        QueryMsg::GetMetadata {} => query_ownable_metadata(deps),
        QueryMsg::GetWidgetState {} => query_ownable_widget_state(deps),
    }
}

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_config = CONFIG.load(deps.storage)?;
    to_json_binary(&widget_config)
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
    let meta = METADATA.load(deps.storage)?;
    to_json_binary(&meta)
}

fn apply_drink(deps: DepsMut, consumption_amount: u8) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    if config.current_amount < consumption_amount {
        return Err(ContractError::CustomError {
            val: "Attempt to drink more than is available".into(),
        });
    }

    config.current_amount -= consumption_amount;
    CONFIG.save(deps.storage, &config.clone())?;

    Ok(Response::new()
        .add_attribute("method", "try_drink")
        .add_attribute("new_amount", config.current_amount.to_string()))
}
