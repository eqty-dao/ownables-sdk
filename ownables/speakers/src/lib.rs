use cosmwasm_std::MessageInfo;
use ownable_std::abi::{AbiResponse, AbiResultPayload, HostAbiError, cbor_from_slice, cbor_to_vec};
use ownable_std::{
    IdbStateDump, OwnableEvent, PublicEvent, create_env, load_owned_deps, ownable_host_abi_v1,
};
use serde::{Deserialize, Serialize};

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
struct AbiRegisterRequest {
    msg: PublicEvent,
    info: MessageInfo,
    mem: IdbStateDump,
}

#[derive(Serialize, Deserialize)]
struct AbiIngestRequest {
    msg: OwnableEvent,
    info: MessageInfo,
    mem: IdbStateDump,
}

fn instantiate_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiInstantiateRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(None);

    let response = contract::instantiate(deps.as_mut(), create_env(), request.info, request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: cbor_to_vec(&AbiResponse::from(response))?,
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
        result: cbor_to_vec(&AbiResponse::from(response))?,
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
        result: response.to_vec(),
        mem: None,
    };

    cbor_to_vec(&payload)
}

fn register_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiRegisterRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(Some(request.mem));

    let response = contract::register(request.info, deps.as_mut(), request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: cbor_to_vec(&AbiResponse::from(response))?,
        mem: Some(IdbStateDump::from(deps.storage)),
    };

    cbor_to_vec(&payload)
}

fn ingest_handler(input: &[u8]) -> Result<Vec<u8>, HostAbiError> {
    let request: AbiIngestRequest = cbor_from_slice(input)?;
    let mut deps = load_owned_deps(Some(request.mem));

    let response = contract::ingest(request.info, deps.as_mut(), request.msg)
        .map_err(HostAbiError::from_display)?;

    let payload = AbiResultPayload {
        result: cbor_to_vec(&AbiResponse::from(response))?,
        mem: Some(IdbStateDump::from(deps.storage)),
    };

    cbor_to_vec(&payload)
}

ownable_host_abi_v1!(
    instantiate = instantiate_handler,
    execute = execute_handler,
    query = query_handler,
    register = register_handler,
    ingest = ingest_handler,
);
