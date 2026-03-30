use cosmwasm_std::MessageInfo;
use ownable_std::abi::{cbor_from_slice, cbor_to_vec, AbiResponse, AbiResultPayload, HostAbiError};
use ownable_std::{create_env, ownable_host_abi_v1, ExternalEventMsg, IdbStateDump, load_owned_deps};
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
struct AbiExternalEventRequest {
    msg: ExternalEventMsg,
    info: MessageInfo,
    ownable_id: String,
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
        result: cbor_to_vec(&AbiResponse::from(response))?,
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

#[cfg(test)]
mod cbor_tests {
    use super::*;
    use crate::msg::QueryMsg;

    fn hex_to_bytes(hex: &str) -> Vec<u8> {
        (0..hex.len()).step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn test_deserialize_instantiate_request() {
        // cbor-x encode({ msg: {ownable_id, package, network_id, keywords}, info: {sender, funds} })
        let bytes = hex_to_bytes("b90002636d7367b900046a6f776e61626c655f696466616263313233677061636b616765666465663435366a6e6574776f726b5f69641a00014a34686b6579776f7264738064696e666fb900026673656e646572782a3078663339466436653531616164383846364634636536614238383237323739636666466239323236366566756e647380");
        let result: Result<AbiInstantiateRequest, _> = cbor_from_slice(&bytes);
        assert!(result.is_ok(), "deserialization failed: {:?}", result.err());
    }

    #[test]
    fn test_deserialize_query_get_info() {
        // cbor-x encode({ msg: {get_info: {}}, mem: {state_dump: []} })
        let bytes = hex_to_bytes("b90002636d7367b90001686765745f696e666fb90000636d656db900016a73746174655f64756d7080");
        let result: Result<AbiQueryRequest, _> = cbor_from_slice(&bytes);
        assert!(result.is_ok(), "deserialization failed: {:?}", result.err());
        assert!(matches!(result.unwrap().msg, QueryMsg::GetInfo {}));
    }

    #[test]
    fn test_deserialize_query_get_widget_state() {
        // cbor-x encode({ msg: {get_widget_state: {}}, mem: {state_dump: []} })
        let bytes = hex_to_bytes("b90002636d7367b90001706765745f7769646765745f7374617465b90000636d656db900016a73746174655f64756d7080");
        let result: Result<AbiQueryRequest, _> = cbor_from_slice(&bytes);
        assert!(result.is_ok(), "deserialization failed: {:?}", result.err());
        assert!(matches!(result.unwrap().msg, QueryMsg::GetWidgetState {}));
    }
}
