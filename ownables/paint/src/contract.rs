use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{
    CONFIG, Config, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID,
};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Attribute, Binary, Event, to_json_binary};
use cw2::set_contract_version;
use ownable_std::{
    EncodePublicEventRequest, InfoResponse, Metadata, OwnableEvent, OwnableInfo, PublicEvent,
    ensure_owner, get_random_color, package_title_from_name,
};

// version info for migration info
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
        ownable_type: Some("paint".to_string()),
    };

    let package_title = package_title_from_name(env!("CARGO_PKG_NAME"));
    let metadata = Metadata {
        image: None,
        image_data: None,
        external_url: None,
        description: Some(env!("CARGO_PKG_DESCRIPTION").to_string()),
        name: Some(package_title.clone()),
        background_color: None,
        animation_url: None,
        youtube_url: None,
    };
    let config = Config {
        consumed_by: None,
        color: get_random_color(msg.clone().ownable_id),
    };

    NETWORK_ID.save(deps.storage, &msg.network_id)?;
    CONFIG.save(deps.storage, &config.clone())?;
    if let Some(nft) = msg.nft {
        NFT_ITEM.save(deps.storage, &nft)?;
    }
    METADATA.save(deps.storage, &metadata)?;
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
        ExecuteMsg::Consume {} => try_consume(info, deps),
        ExecuteMsg::Transfer { to } => try_transfer(info, deps, to),
    }
}

pub fn register(
    info: MessageInfo,
    deps: DepsMut,
    event: PublicEvent,
) -> Result<Response, ContractError> {
    let _ = (info, deps);
    Err(ContractError::MatchEventError {
        val: event.event_type,
    })
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
    Err(ContractError::MatchEventError {
        val: request.event_type,
    })
}


pub fn try_consume(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    let ownership = OWNABLE_INFO.load(deps.storage)?;
    let config = CONFIG.load(deps.storage)?;
    ensure_owner(&ownership, &info.sender, || ContractError::Unauthorized {
        val: "Unauthorized consumption attempt".into(),
    })?;
    let mut config = config;

    if let Some(_) = config.consumed_by {
        return Err(ContractError::CustomError {
            val: "already consumed".into(),
        });
    }
    config.consumed_by = Some(ownership.clone().owner);
    CONFIG.save(deps.storage, &config.clone())?;

    let mut event = Event::new("consume".to_string());
    event = event.add_attributes(vec![
        Attribute {
            key: "issuer".to_string(),
            value: ownership.issuer.to_string(),
        },
        Attribute {
            key: "owner".to_string(),
            value: ownership.owner.to_string(),
        },
        Attribute {
            key: "consumed_by".to_string(),
            value: config.consumed_by.unwrap().to_string(),
        },
        Attribute {
            key: "consumable_type".to_string(),
            value: ownership.ownable_type.unwrap_or("armor".to_string()),
        },
        Attribute {
            key: "color".to_string(),
            value: config.color.to_string(),
        },
    ]);

    Ok(Response::new()
        .add_attribute("method", "try_consume")
        .add_attribute("external_event", true.to_string())
        .add_event(event))
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
        QueryMsg::IsConsumed {} => query_consumed_state(deps),
    }
}

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_config = CONFIG.load(deps.storage)?;
    to_json_binary(&widget_config)
}


fn query_consumed_state(deps: Deps) -> StdResult<Binary> {
    let config = CONFIG.load(deps.storage)?;
    let is_consumed = config.consumed_by.is_some();
    to_json_binary(&is_consumed)
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
