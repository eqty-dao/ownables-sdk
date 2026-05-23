use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use crate::state::{
    CONFIG, Config, LOCKED, METADATA, NETWORK_ID, NFT_ITEM, OWNABLE_INFO, PACKAGE_CID,
};
#[cfg(not(feature = "library"))]
use cosmwasm_std::{Addr, Deps, DepsMut, Env, MessageInfo, Response, StdResult};
use cosmwasm_std::{Binary, to_json_binary};
use cw2::set_contract_version;
use ownable_std::{
    EncodePublicEventRequest, InfoResponse, Metadata, OwnableEvent, OwnableInfo, PublicEvent,
    ensure_owner, package_title_from_name, rgb_hex,
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
    CONFIG.save(deps.storage, &config.clone())?;
    if let Some(nft) = msg.nft {
        NFT_ITEM.save(deps.storage, &nft)?;
    }
    METADATA.save(deps.storage, &meta)?;
    LOCKED.save(deps.storage, &false)?;
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
        ExecuteMsg::Lock {} => try_lock(info, deps),
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
    match event.event_type.as_str() {
        "consume" => try_ingest_consume(info, deps, event),
        _ => Err(ContractError::MatchEventError {
            val: event.event_type,
        }),
    }
}

pub fn encode_public_event(request: EncodePublicEventRequest) -> Result<Vec<u8>, ContractError> {
    Err(ContractError::MatchEventError {
        val: request.event_type,
    })
}

fn try_ingest_consume(
    _info: MessageInfo,
    deps: DepsMut,
    event: OwnableEvent,
) -> Result<Response, ContractError> {
    let owner = event.source.owner.clone();
    let issuer = event.source.issuer.clone();
    let ownable_id = event.source.id.clone();
    let consumed_by = event
        .attributes
        .get("consumed_by")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let color = event
        .attributes
        .get("color")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let consumable_type = event
        .attributes
        .get("consumable_type")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();

    if consumable_type == "paint" {
        if color.is_empty() {
            return Err(ContractError::InvalidExternalEventArgs {});
        }
    }
    if ownable_id.is_empty()
        || consumable_type.is_empty()
        || issuer.is_empty()
        || consumed_by.is_empty()
        || owner.is_empty()
    {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let ownership = OWNABLE_INFO.load(deps.storage)?;

    // validate issuer of collection matches
    if ownership.issuer.to_string() != issuer {
        return Err(ContractError::InvalidExternalEventArgs {});
    }

    let mut config = CONFIG.load(deps.storage)?;
    match consumable_type.as_str() {
        "antenna" => {
            config.has_antenna = true;
        }
        "armor" => {
            config.has_armor = true;
        }
        "paint" => {
            config.color = color;
        }
        "speakers" => {
            config.has_speaker = true;
        }
        _ => {}
    }
    config
        .consumed_ownable_ids
        .push(Addr::unchecked(ownable_id));
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "try_ingest_consume")
        .add_attribute("status", "success"))
}

pub fn try_lock(info: MessageInfo, deps: DepsMut) -> Result<Response, ContractError> {
    // only ownable owner can lock it
    let ownership = OWNABLE_INFO.load(deps.storage)?;
    ensure_owner(&ownership, &info.sender, || ContractError::Unauthorized {
        val: "Unauthorized".into(),
    })?;

    let is_locked = LOCKED.update(deps.storage, |mut is_locked| -> Result<_, ContractError> {
        if is_locked {
            return Err(ContractError::LockError {
                val: "Already locked".to_string(),
            });
        }
        is_locked = true;
        Ok(is_locked)
    })?;

    Ok(Response::new()
        .add_attribute("method", "try_lock")
        .add_attribute("is_locked", is_locked.to_string()))
}

pub fn try_transfer(info: MessageInfo, deps: DepsMut, to: Addr) -> Result<Response, ContractError> {
    let is_locked = LOCKED.load(deps.storage)?;
    if is_locked {
        return Err(ContractError::LockError {
            val: "Unable to transfer a locked ownable".to_string(),
        });
    }
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
        QueryMsg::IsLocked {} => query_lock_state(deps),
        QueryMsg::IsConsumerOf {
            issuer,
            consumable_type,
        } => query_is_consumer_of(deps, issuer, consumable_type),
    }
}

fn query_is_consumer_of(deps: Deps, issuer: Addr, consumable_type: String) -> StdResult<Binary> {
    let ownable_info = OWNABLE_INFO.load(deps.storage)?;

    let can_consume = match consumable_type.as_str() {
        "antenna" => true,
        "armor" => true,
        "paint" => true,
        "speakers" => true,
        _ => false,
    };
    let same_issuer = ownable_info.issuer == issuer;
    to_json_binary(&(can_consume && same_issuer))
}

fn query_ownable_widget_state(deps: Deps) -> StdResult<Binary> {
    let widget_config = CONFIG.load(deps.storage)?;
    to_json_binary(&widget_config)
}

fn query_lock_state(deps: Deps) -> StdResult<Binary> {
    let is_locked = LOCKED.load(deps.storage)?;
    to_json_binary(&is_locked)
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

#[cfg(test)]
mod tests {
    use super::{ingest, instantiate, register};
    use crate::msg::InstantiateMsg;
    use crate::state::CONFIG;
    use cosmwasm_std::testing::{mock_dependencies, mock_env};
    use cosmwasm_std::{Addr, MessageInfo, Uint128};
    use ownable_std::{OwnableEvent, OwnableEventSource, PublicEvent};
    use serde_json::json;

    fn test_info(sender: &str) -> MessageInfo {
        MessageInfo {
            sender: Addr::unchecked(sender),
            funds: vec![],
        }
    }

    #[test]
    fn register_rejects_all_event_types() {
        let mut deps = mock_dependencies();
        let event = PublicEvent {
            source: "0xsource".to_string(),
            event_type: "lock".to_string(),
            data: vec![0x01, 0x02].into(),
            block_number: 1,
            transaction_hash: vec![0xaa].into(),
            transaction_index: 0,
            log_index: 0,
        };

        let err = register(test_info("owner"), deps.as_mut(), event).unwrap_err();
        assert_eq!(err.to_string(), "Unknown event type: \"lock\"");
    }

    #[test]
    fn ingest_consume_updates_robot_config() {
        let mut deps = mock_dependencies();
        instantiate(
            deps.as_mut(),
            mock_env(),
            test_info("issuer"),
            InstantiateMsg {
                ownable_id: "robot-id".to_string(),
                package: "pkg".to_string(),
                network_id: 1,
                ownable_type: None,
                nft: Some(ownable_std::NFT {
                    id: Uint128::one(),
                    network: "eip155:1".to_string(),
                    address: "nft-contract".to_string(),
                    lock_service: None,
                }),
            },
        )
        .unwrap();

        let event = OwnableEvent {
            source: OwnableEventSource {
                id: "paint-ownable".to_string(),
                owner: "issuer".to_string(),
                issuer: "issuer".to_string(),
            },
            event_type: "consume".to_string(),
            attributes: json!({
                "consumed_by": "robot-owner",
                "consumable_type": "paint",
                "color": "#ff00ff"
            }),
        };

        ingest(test_info("wallet"), deps.as_mut(), event).unwrap();

        let config = CONFIG.load(&deps.storage).unwrap();
        assert_eq!(config.color, "#ff00ff");
        assert_eq!(config.consumed_ownable_ids.len(), 1);
        assert_eq!(
            config.consumed_ownable_ids[0],
            Addr::unchecked("paint-ownable")
        );
        assert!(!config.has_antenna);
        assert!(!config.has_armor);
        assert!(!config.has_speaker);
    }

    #[test]
    fn ingest_consume_requires_source_id() {
        let mut deps = mock_dependencies();
        instantiate(
            deps.as_mut(),
            mock_env(),
            test_info("issuer"),
            InstantiateMsg {
                ownable_id: "robot-id".to_string(),
                package: "pkg".to_string(),
                network_id: 1,
                ownable_type: None,
                nft: None,
            },
        )
        .unwrap();

        let event = OwnableEvent {
            source: OwnableEventSource {
                id: "".to_string(),
                owner: "issuer".to_string(),
                issuer: "issuer".to_string(),
            },
            event_type: "consume".to_string(),
            attributes: json!({
                "consumed_by": "robot-owner",
                "consumable_type": "antenna"
            }),
        };

        let err = ingest(test_info("wallet"), deps.as_mut(), event).unwrap_err();
        assert_eq!(err.to_string(), "Invalid external event args");
    }
}
