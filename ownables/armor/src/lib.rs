use cosmwasm_std::MessageInfo;
use ownable_std::abi::{cbor_from_slice, cbor_to_vec, HostAbiError};
use ownable_std::{create_env, ownable_host_abi_v1, ExternalEventMsg, IdbStateDump, load_owned_deps};
use serde::{Deserialize, Serialize};
use serde_json::to_string;

use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};

pub mod contract;
pub mod error;
pub mod msg;
pub mod state;

#[derive(Serialize, Deserialize)]
struct AbiInstantiateRequest {
    msg: InstantiateMsg,
    info: MessageInfo,
}

#[derive(Serialize, Deserialize)]
struct AbiExecuteRequest {
    msg: ExecuteMsg,
    info: MessageInfo,
    mem: IdbStateDump,
}

#[derive(Serialize, Deserialize)]
struct AbiQueryRequest {
    msg: QueryMsg,
    mem: IdbStateDump,
}

#[derive(Serialize, Deserialize)]
struct AbiExternalEventRequest {
    msg: ExternalEventMsg,
    info: MessageInfo,
    ownable_id: String,
    mem: IdbStateDump,
}

#[derive(Serialize, Deserialize)]
struct AbiResultPayload {
    result: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mem: Option<IdbStateDump>,
}

fn instantiate_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiInstantiateRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(None);

    let response = contract::instantiate(deps.as_mut(), create_env(), request.info, request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: to_string(&response).map_err(HostAbiError::from_display)?,
        mem: Some(IdbStateDump::from(deps.storage)),
    };

    cbor_to_vec(&payload)
}

fn execute_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiExecuteRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(Some(request.mem));

    let response = contract::execute(deps.as_mut(), create_env(), request.info, request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: to_string(&response).map_err(HostAbiError::from_display)?,
        mem: Some(IdbStateDump::from(deps.storage)),
    };

    cbor_to_vec(&payload)
}

fn query_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiQueryRequest = cbor_from_slice(input)?;
    let deps = load_owned_deps(Some(request.mem));

    let response = contract::query(deps.as_ref(), create_env(), request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: to_string(&response).map_err(HostAbiError::from_display)?,
        mem: None,
    };

    cbor_to_vec(&payload)
}

fn external_event_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiExternalEventRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(Some(request.mem));

    let response = contract::register_external_event(
        request.info,
        deps.as_mut(),
        request.msg,
        request.ownable_id,
    )
    .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: to_string(&response).map_err(HostAbiError::from_display)?,
        mem: Some(IdbStateDump::from(deps.storage)),
    };

    cbor_to_vec(&payload)
}

ownable_host_abi_v1!(
    instantiate = instantiate_handler,
    execute = execute_handler,
    query = query_handler,
    external_event = external_event_handler,
);
