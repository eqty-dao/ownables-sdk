use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{CONFIG, Config, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_json_binary};
use cw2::set_contract_version;
use ownable_std::{
    ExternalEventMsg, InfoResponse, Metadata, OwnableInfo, package_title_from_name, rgb_hex,
};

const CONTRACT_NAME: &str = concat!("crates.io:", env!("CARGO_PKG_NAME"));
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

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
        ownable_type: Some("robot".to_string()),
    };

    let config = Config {
        consumed_ownable_ids: vec![],
        color: rgb_hex(25, 82, 114),
        has_antenna: false,
        has_speaker: false,
        has_armor: false,
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
    CONFIG.save(deps.storage, &config)?;
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
        .add_attribute("color", config.color))
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

pub fn register_external_event(
    info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
    ownable_id: String,
) -> Result<Response, ContractError> {
    let mut response = Response::new().add_attribute("method", "register_external_event");

    match event.event_type.as_str() {
        "consume" => {
            try_register_consume(info, deps, event, ownable_id)?;
            response = response.add_attribute("event_type", "consume");
        }
        _ => {
            return Err(ContractError::MatchEventError {
                val: event.event_type,
            });
        }
    };

    Ok(response)
}

fn try_register_consume(
    _info: MessageInfo,
    deps: DepsMut,
    event: ExternalEventMsg,
    ownable_id: String,
) -> Result<Response, ContractError> {
    let owner = event.attributes.get("owner").cloned().unwrap_or_default();
    let consumed_by = event
        .attributes
        .get("consumed_by")
        .cloned()
        .unwrap_or_default();
    let issuer = event.attributes.get("issuer").cloned().unwrap_or_default();
    let color = event.attributes.get("color").cloned().unwrap_or_default();
    let consumable_type = event
        .attributes
        .get("consumable_type")
        .cloned()
        .unwrap_or_default();

    if consumable_type == "paint" && color.is_empty() {
        return Err(ContractError::InvalidExternalEventArgs {});
    }
    if consumable_type.is_empty() || issuer.is_empty() || consumed_by.is_empty() || owner.is_empty()
    {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let ownership = OWNABLE_INFO.load(deps.storage)?;
    if ownership.issuer.to_string() != issuer {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let mut config = CONFIG.load(deps.storage)?;
    match consumable_type.as_str() {
        "antenna" => config.has_antenna = true,
        "armor" => config.has_armor = true,
        "paint" => config.color = color,
        "speakers" => config.has_speaker = true,
        _ => {}
    }
    config
        .consumed_ownable_ids
        .push(Addr::unchecked(ownable_id));
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "try_register_consume")
        .add_attribute("status", "success"))
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
        QueryMsg::IsConsumerOf {
            issuer,
            consumable_type,
        } => query_is_consumer_of(deps, issuer, consumable_type),
    }
}

fn query_is_consumer_of(deps: Deps, issuer: Addr, consumable_type: String) -> StdResult<Binary> {
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;

    let can_consume = match consumable_type.as_str() {
        "antenna" | "armor" | "paint" | "speakers" => true,
        _ => false,
    };
    let same_issuer = ownable_info.issuer == issuer;
    to_json_binary(&(can_consume && same_issuer))
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
