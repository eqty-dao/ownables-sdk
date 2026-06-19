use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{CONFIG, Config, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_json_binary};
use cw2::set_contract_version;
use ownable_std::{
    ExternalEventMsg, InfoResponse, Metadata, OwnableInfo, ensure_owner, get_random_color,
    package_title_from_name,
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

pub fn register_external_event(
    _info: MessageInfo,
    _deps: DepsMut,
    event: ExternalEventMsg,
    _ownable_id: String,
) -> Result<Response, ContractError> {
    Err(ContractError::MatchEventError {
        val: event.event_type,
    })
}

pub fn try_drink(
    info: MessageInfo,
    deps: DepsMut,
    consumption_amount: u8,
) -> Result<Response, ContractError> {
    let ownership = OWNABLE_INFO.load(deps.storage)?;
    let config = CONFIG.load(deps.storage)?;
    ensure_owner(&ownership, &info.sender, || ContractError::Unauthorized {
        val: "Unable to drink potion".into(),
    })?;

    let mut c = config;
    if c.current_amount < consumption_amount {
        return Err(ContractError::CustomError {
            val: "Attempt to drink more than is available".into(),
        });
    }
    c.current_amount -= consumption_amount;
    CONFIG.save(deps.storage, &c)?;

    Ok(Response::new()
        .add_attribute("method", "try_drink")
        .add_attribute("new_amount", c.current_amount.to_string()))
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
